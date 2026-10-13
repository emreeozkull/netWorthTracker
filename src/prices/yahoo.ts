import { getJson, type Quote } from './http';

interface ChartResponse {
  chart: {
    result?: { meta: { regularMarketPrice?: number; currency?: string } }[];
    error?: { description?: string } | null;
  };
}

/**
 * Yahoo Finance chart endpoint. Unofficial and keyless; covers global stocks
 * (AAPL, THYAO.IS), ETFs, funds, crypto (BTC-USD), futures (GC=F) and FX (USDTRY=X).
 */
export async function yahooQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await getJson<ChartResponse>(url, { 'User-Agent': 'Mozilla/5.0' });
  const meta = res.chart.result?.[0]?.meta;
  if (!meta?.regularMarketPrice || !meta.currency) {
    throw new Error(res.chart.error?.description ?? `No quote for ${symbol}`);
  }
  // London listings quote in pence.
  if (meta.currency === 'GBp') return { price: meta.regularMarketPrice / 100, currency: 'GBP' };
  return { price: meta.regularMarketPrice, currency: meta.currency.toUpperCase() };
}
