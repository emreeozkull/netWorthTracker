import { GRAMS_PER_TROY_OUNCE, goldUnitPrice } from './gold';
import type { Asset, Holding, Market } from './types';

/** Units of `currency` per 1 USD, or undefined when unknown. */
export function usdRate(market: Market, currency: string): number | undefined {
  if (currency === 'USD') return 1;
  const rate = market.manualRates[currency] ?? market.usdRates[currency];
  return rate && rate > 0 ? rate : undefined;
}

export function convert(
  amount: number,
  from: string,
  to: string,
  market: Market,
): number | undefined {
  if (from === to) return amount;
  const fromRate = usdRate(market, from);
  const toRate = usdRate(market, to);
  if (fromRate === undefined || toRate === undefined) return undefined;
  return (amount / fromRate) * toRate;
}

/** Price of one gram of pure gold in `currency`. */
export function goldGramPrice(market: Market, currency: string): number | undefined {
  if (market.manualGoldGram) {
    return convert(market.manualGoldGram.price, market.manualGoldGram.currency, currency, market);
  }
  if (market.goldUsdPerOunce) {
    return convert(market.goldUsdPerOunce / GRAMS_PER_TROY_OUNCE, 'USD', currency, market);
  }
  return undefined;
}

/** Price of one unit of the asset, in the asset's own currency. */
export function unitPrice(asset: Asset, market: Market): number | undefined {
  if (asset.kind === 'cash' || asset.kind === 'debt') return 1;
  switch (asset.priceMode) {
    case 'derivedGold': {
      const gram = goldGramPrice(market, asset.currency);
      return gram === undefined ? undefined : goldUnitPrice(asset.goldUnit ?? 'gram', gram);
    }
    case 'auto':
      return asset.lastPrice ?? asset.manualPrice;
    case 'manual':
      return asset.manualPrice;
  }
}

/** Signed value of a holding in `base` currency; debts are negative. */
export function holdingValue(
  holding: Holding,
  asset: Asset,
  market: Market,
  base: string,
): number | undefined {
  const price = unitPrice(asset, market);
  if (price === undefined) return undefined;
  const value = convert(holding.quantity * price, asset.currency, base, market);
  if (value === undefined) return undefined;
  return asset.kind === 'debt' ? -value : value;
}
