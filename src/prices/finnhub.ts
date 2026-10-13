import { getJson, type Quote } from './http';

/** Finnhub quote with the user's own API key. Free tier covers US listings, quoted in USD. */
export async function finnhubQuote(symbol: string, apiKey: string): Promise<Quote> {
  const res = await getJson<{ c?: number }>(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`,
    { 'X-Finnhub-Token': apiKey },
  );
  if (!res.c) throw new Error(`No Finnhub quote for ${symbol}`);
  return { price: res.c, currency: 'USD' };
}
