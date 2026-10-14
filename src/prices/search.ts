import type { AssetKind } from '@/domain/types';

import { coingeckoId } from './coingecko';
import { getJson } from './http';

export interface SymbolMatch {
  /** Value to store in `Asset.symbol`, e.g. AAPL, THYAO.IS, BTC, solana. */
  symbol: string;
  name: string;
  exchange?: string;
  kind: AssetKind;
  currency?: string;
}

export interface SearchOptions {
  signal?: AbortSignal;
  /** Rank Borsa Istanbul listings first (e.g. for users whose base currency is TRY). */
  preferIstanbul?: boolean;
  limit?: number;
}

const YAHOO_TYPES: Record<string, AssetKind> = {
  EQUITY: 'stock',
  ETF: 'etf',
  MUTUALFUND: 'fund',
  CRYPTOCURRENCY: 'crypto',
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : undefined;

/**
 * Maps Yahoo's /v1/finance/search response. Keeps only instruments we can price
 * (equities, ETFs, mutual funds, crypto); drops futures, indices, FX and options.
 */
export function parseYahooSearch(json: unknown): SymbolMatch[] {
  const quotes = (json as { quotes?: unknown } | null)?.quotes;
  if (!Array.isArray(quotes)) return [];
  const out: SymbolMatch[] = [];
  for (const q of quotes as Record<string, unknown>[]) {
    if (!q || typeof q !== 'object' || q.isYahooFinance === false) continue;
    const symbol = str(q.symbol);
    const kind = YAHOO_TYPES[String(q.quoteType)];
    if (!symbol || !kind) continue;
    out.push({
      symbol,
      name: str(q.longname) ?? str(q.shortname) ?? symbol,
      exchange: str(q.exchDisp) ?? str(q.exchange),
      kind,
    });
  }
  return out;
}

/**
 * Maps CoinGecko's /api/v3/search response. Uses the ticker as the symbol when it
 * resolves to the same coin (BTC → bitcoin), otherwise the unambiguous CoinGecko id.
 */
export function parseCoinGeckoSearch(json: unknown): SymbolMatch[] {
  const coins = (json as { coins?: unknown } | null)?.coins;
  if (!Array.isArray(coins)) return [];
  const out: SymbolMatch[] = [];
  for (const c of coins as Record<string, unknown>[]) {
    if (!c || typeof c !== 'object') continue;
    const id = str(c.id);
    if (!id) continue;
    const ticker = str(c.symbol)?.toUpperCase();
    const symbol = ticker && coingeckoId(ticker) === id ? ticker : id;
    out.push({
      symbol,
      name: str(c.name) ?? id,
      // When the id is stored, still show the familiar ticker next to it.
      exchange: ticker && ticker !== symbol ? ticker : undefined,
      kind: 'crypto',
    });
  }
  return out;
}

const isIstanbul = (m: SymbolMatch) => m.symbol.toUpperCase().endsWith('.IS');

/** Removes duplicate symbols and optionally moves BIST listings to the top, keeping relevance order otherwise. */
export function rankMatches(matches: SymbolMatch[], opts: { preferIstanbul?: boolean; limit?: number } = {}) {
  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const key = m.symbol.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ranked = opts.preferIstanbul
    ? [...unique.filter(isIstanbul), ...unique.filter((m) => !isIstanbul(m))]
    : unique;
  return ranked.slice(0, opts.limit ?? 8);
}

async function searchYahoo(query: string, signal?: AbortSignal): Promise<SymbolMatch[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`;
  return parseYahooSearch(await getJson(url, { 'User-Agent': 'Mozilla/5.0' }, signal));
}

async function searchCoinGecko(query: string, signal?: AbortSignal): Promise<SymbolMatch[]> {
  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
  return parseCoinGeckoSearch(await getJson(url, undefined, signal));
}

/**
 * Finds instruments matching what the user typed. Crypto searches CoinGecko (falling back
 * to Yahoo's crypto pairs); everything else searches Yahoo, which covers BIST (THY → THYAO.IS).
 * Only call this when the user has enabled online prices: the query leaves the device.
 */
export async function searchSymbols(
  query: string,
  kind?: AssetKind,
  opts: SearchOptions = {},
): Promise<SymbolMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  let matches: SymbolMatch[];
  if (kind === 'crypto') {
    try {
      matches = await searchCoinGecko(q, opts.signal);
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      matches = (await searchYahoo(q, opts.signal)).filter((m) => m.kind === 'crypto');
    }
  } else {
    matches = await searchYahoo(q, opts.signal);
  }
  return rankMatches(matches, opts);
}
