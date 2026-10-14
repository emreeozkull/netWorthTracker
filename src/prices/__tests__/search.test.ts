/// <reference types="jest" />
/// <reference types="node" />

import { parseCoinGeckoSearch, parseYahooSearch, rankMatches, searchSymbols } from '../search';

// Trimmed from a real response of
// https://query2.finance.yahoo.com/v1/finance/search?q=THY&quotesCount=8&newsCount=0
const yahooThy = {
  explains: [],
  count: 5,
  quotes: [
    {
      exchange: 'PCX',
      shortname: 'Toews Agility Shares Dynamic Ta',
      quoteType: 'ETF',
      symbol: 'THY',
      index: 'quotes',
      score: 10007000,
      typeDisp: 'ETF',
      longname: 'Toews Agility Shares Dynamic Tactical Income ETF',
      exchDisp: 'NYSEArca',
      isYahooFinance: true,
    },
    {
      exchange: 'GER',
      shortname: 'thyssenkrupp AG               I',
      quoteType: 'EQUITY',
      symbol: 'TKA.DE',
      typeDisp: 'Equity',
      longname: 'thyssenkrupp AG',
      exchDisp: 'XETRA',
      isYahooFinance: true,
    },
    {
      exchange: 'IST',
      shortname: 'TURK HAVA YOLLARI',
      quoteType: 'EQUITY',
      symbol: 'THYAO.IS',
      typeDisp: 'Equity',
      longname: 'Türk Hava Yollari Anonim Ortakligi',
      exchDisp: 'IST',
      isYahooFinance: true,
    },
    {
      exchange: 'CME',
      shortname: 'Bitcoin Futures,Oct-2026',
      quoteType: 'FUTURE',
      symbol: 'BTC=F',
      exchDisp: 'Chicago Mercantile Exchange',
      isYahooFinance: true,
    },
    {
      exchange: 'NAS',
      shortname: 'Vanguard 500 Index Fd Admiral S',
      quoteType: 'MUTUALFUND',
      symbol: 'VFIAX',
      exchDisp: 'NASDAQ',
      isYahooFinance: true,
    },
    {
      exchange: 'CCC',
      shortname: 'Bitcoin USD',
      quoteType: 'CRYPTOCURRENCY',
      symbol: 'BTC-USD',
      longname: 'Bitcoin USD',
      exchDisp: 'CCC',
      isYahooFinance: true,
    },
    { exchange: 'IST', quoteType: 'INDEX', symbol: 'XU030.IS', shortname: 'BIST 30', isYahooFinance: true },
    { quoteType: 'EQUITY', symbol: 'NOTYAHOO', isYahooFinance: false },
  ],
  news: [],
};

// Trimmed from a real response of https://api.coingecko.com/api/v3/search?query=sol
const coingeckoSol = {
  coins: [
    { id: 'solana', name: 'Solana', api_symbol: 'solana', symbol: 'SOL', market_cap_rank: 7, thumb: 'x' },
    { id: 'solv-protocol', name: 'Solv Protocol', api_symbol: 'solv-protocol', symbol: 'SOLV', market_cap_rank: 803 },
    { name: 'missing id' },
  ],
  exchanges: [],
  icos: [],
  categories: [],
  nfts: [],
};

describe('parseYahooSearch', () => {
  it('maps quote types to asset kinds and drops unpriceable instruments', () => {
    const matches = parseYahooSearch(yahooThy);
    expect(matches.map((m) => [m.symbol, m.kind])).toEqual([
      ['THY', 'etf'],
      ['TKA.DE', 'stock'],
      ['THYAO.IS', 'stock'],
      ['VFIAX', 'fund'],
      ['BTC-USD', 'crypto'],
    ]);
  });

  it('prefers the long name, falls back to a whitespace-collapsed short name, and uses the display exchange', () => {
    const [thy, tka, thyao, vfiax] = parseYahooSearch(yahooThy);
    expect(thy.name).toBe('Toews Agility Shares Dynamic Tactical Income ETF');
    expect(thy.exchange).toBe('NYSEArca');
    expect(tka.name).toBe('thyssenkrupp AG');
    expect(thyao).toEqual({
      symbol: 'THYAO.IS',
      name: 'Türk Hava Yollari Anonim Ortakligi',
      exchange: 'IST',
      kind: 'stock',
    });
    expect(vfiax.name).toBe('Vanguard 500 Index Fd Admiral S');
  });

  it('tolerates malformed payloads', () => {
    expect(parseYahooSearch(null)).toEqual([]);
    expect(parseYahooSearch({})).toEqual([]);
    expect(parseYahooSearch({ quotes: 'nope' })).toEqual([]);
    expect(parseYahooSearch({ quotes: [null, 1, { symbol: 'X' }] })).toEqual([]);
  });
});

describe('parseCoinGeckoSearch', () => {
  it('uses the ticker when it resolves to the same coin, otherwise the CoinGecko id', () => {
    expect(parseCoinGeckoSearch(coingeckoSol)).toEqual([
      { symbol: 'SOL', name: 'Solana', exchange: undefined, kind: 'crypto' },
      { symbol: 'solv-protocol', name: 'Solv Protocol', exchange: 'SOLV', kind: 'crypto' },
    ]);
  });

  it('tolerates malformed payloads', () => {
    expect(parseCoinGeckoSearch(undefined)).toEqual([]);
    expect(parseCoinGeckoSearch({ coins: {} })).toEqual([]);
  });
});

describe('rankMatches', () => {
  const matches = parseYahooSearch(yahooThy);

  it('keeps relevance order by default and applies the limit', () => {
    expect(rankMatches(matches, { limit: 2 }).map((m) => m.symbol)).toEqual(['THY', 'TKA.DE']);
  });

  it('moves Borsa Istanbul listings first when preferred', () => {
    expect(rankMatches(matches, { preferIstanbul: true })[0].symbol).toBe('THYAO.IS');
  });

  it('removes duplicate symbols case-insensitively', () => {
    const dupes = [...matches, { ...matches[0], symbol: 'thy' }];
    expect(rankMatches(dupes, { limit: 20 })).toHaveLength(matches.length);
  });
});

describe('searchSymbols', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const mockFetch = (handler: (url: string) => unknown) => {
    const fn = jest.fn(async (url: string) => {
      const body = handler(url);
      if (body instanceof Error) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    });
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  };

  it('does not hit the network for short queries', async () => {
    const fn = mockFetch(() => yahooThy);
    expect(await searchSymbols(' t ')).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('searches Yahoo for non-crypto kinds and finds BIST listings', async () => {
    const fn = mockFetch(() => yahooThy);
    const results = await searchSymbols('THY', 'stock', { preferIstanbul: true });
    expect(fn.mock.calls[0][0]).toContain('query2.finance.yahoo.com/v1/finance/search?q=THY');
    expect(results[0].symbol).toBe('THYAO.IS');
  });

  it('searches CoinGecko for crypto and falls back to Yahoo crypto pairs', async () => {
    let fn = mockFetch(() => coingeckoSol);
    expect((await searchSymbols('sol', 'crypto'))[0].symbol).toBe('SOL');
    expect(fn.mock.calls[0][0]).toContain('api.coingecko.com/api/v3/search?query=sol');

    fn = mockFetch((url) => (url.includes('coingecko') ? new Error('down') : yahooThy));
    expect((await searchSymbols('btc', 'crypto')).map((m) => m.symbol)).toEqual(['BTC-USD']);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
