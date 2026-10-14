import type { AppData, Asset, Market } from '@/domain/types';
import { convert, usdRate } from '@/domain/valuation';

import { coingeckoQuote } from './coingecko';
import { finnhubQuote } from './finnhub';
import { frankfurterUsdRates } from './frankfurter';
import type { Quote } from './http';
import { yahooQuote } from './yahoo';

export interface PriceUpdate {
  market: Market;
  /** assetId -> price in the asset's own currency */
  prices: Record<string, number>;
  fetchedAt: number;
  errors: string[];
}

async function firstOf(attempts: (() => Promise<Quote>)[]): Promise<Quote> {
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

type QuoteTarget = Pick<Asset, 'kind' | 'symbol' | 'currency'>;

function quoteAttempts(asset: QuoteTarget, finnhubKey?: string): (() => Promise<Quote>)[] {
  const symbol = asset.symbol!.trim();
  if (asset.kind === 'crypto') {
    return [
      () => coingeckoQuote(symbol, asset.currency),
      () => yahooQuote(symbol.includes('-') ? symbol : `${symbol.toUpperCase()}-USD`),
    ];
  }
  const attempts = [() => yahooQuote(symbol)];
  if (finnhubKey) attempts.push(() => finnhubQuote(symbol, finnhubKey));
  return attempts;
}

/** Raw quote for a symbol, in whatever currency the provider reports it. */
export async function fetchQuote(asset: QuoteTarget, finnhubKey?: string): Promise<Quote> {
  if (!asset.symbol?.trim()) throw new Error('No symbol');
  return firstOf(quoteAttempts(asset, finnhubKey));
}

/** Units of `currency` per 1 USD, from Yahoo's FX quote. */
async function fetchUsdRate(currency: string): Promise<number> {
  return (await yahooQuote(`USD${currency}=X`)).price;
}

export interface ConvertedPrice {
  price: number;
  /** Rates fetched to make the conversion possible; merge into `market.usdRates`. */
  usdRates?: Record<string, number>;
}

/** Converts a quote to `currency`, fetching any exchange rate the market is missing. */
export async function quoteInCurrency(quote: Quote, currency: string, market: Market): Promise<ConvertedPrice> {
  const direct = convert(quote.price, quote.currency, currency, market);
  if (direct !== undefined) return { price: direct };
  const usdRates: Record<string, number> = {};
  for (const c of [quote.currency, currency]) {
    if (c !== 'USD' && usdRate(market, c) === undefined) usdRates[c] = await fetchUsdRate(c);
  }
  const price = convert(quote.price, quote.currency, currency, {
    ...market,
    usdRates: { ...market.usdRates, ...usdRates },
  });
  if (price === undefined) throw new Error(`no ${quote.currency}→${currency} rate`);
  return { price, usdRates };
}

/** Current price of one unit of an `auto` asset, in the asset's own currency. Throws on failure. */
export async function fetchAssetQuote(
  asset: QuoteTarget,
  market: Market,
  finnhubKey?: string,
): Promise<ConvertedPrice> {
  return quoteInCurrency(await fetchQuote(asset, finnhubKey), asset.currency, market);
}

/**
 * Fetches FX rates, the gold spot price and quotes for every asset in `auto` mode.
 * Only called when the user has enabled price fetching. Never throws; failures go to `errors`.
 */
export async function fetchPrices(data: AppData): Promise<PriceUpdate> {
  const errors: string[] = [];
  const fetchedAt = Date.now();
  const market: Market = { ...data.market };

  try {
    market.usdRates = await frankfurterUsdRates();
    market.ratesUpdatedAt = fetchedAt;
  } catch (e) {
    errors.push(`FX: ${(e as Error).message}`);
  }

  // Frankfurter lacks some currencies; fill gaps for ones we actually use from Yahoo.
  const needed = new Set([data.settings.baseCurrency, ...data.assets.map((a) => a.currency)]);
  await Promise.all(
    [...needed]
      .filter((c) => c !== 'USD' && !market.usdRates[c])
      .map(async (c) => {
        try {
          market.usdRates = { ...market.usdRates, [c]: await fetchUsdRate(c) };
          market.ratesUpdatedAt = fetchedAt;
        } catch (e) {
          errors.push(`FX ${c}: ${(e as Error).message}`);
        }
      }),
  );

  try {
    const gold = await firstOf([() => yahooQuote('GC=F'), () => coingeckoQuote('PAXG', 'USD')]);
    market.goldUsdPerOunce = gold.price;
    market.goldUpdatedAt = fetchedAt;
  } catch (e) {
    errors.push(`Gold: ${(e as Error).message}`);
  }

  const prices: Record<string, number> = {};
  const autoAssets = data.assets.filter((a) => a.priceMode === 'auto' && a.symbol?.trim());
  await Promise.all(
    autoAssets.map(async (asset) => {
      try {
        const { price, usdRates } = await fetchAssetQuote(asset, market, data.settings.finnhubKey);
        if (usdRates) market.usdRates = { ...market.usdRates, ...usdRates };
        prices[asset.id] = price;
      } catch (e) {
        errors.push(`${asset.symbol}: ${(e as Error).message}`);
      }
    }),
  );

  return { market, prices, fetchedAt, errors };
}
