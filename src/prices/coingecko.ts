import { getJson, type Quote } from './http';

const TICKER_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  TRX: 'tron',
  LTC: 'litecoin',
  LINK: 'chainlink',
  PAXG: 'pax-gold',
};

/** Accepts a ticker (BTC) or a CoinGecko id (bitcoin). */
export function coingeckoId(symbol: string): string {
  return TICKER_TO_ID[symbol.toUpperCase()] ?? symbol.toLowerCase();
}

export async function coingeckoQuote(symbol: string, currency: string): Promise<Quote> {
  const id = coingeckoId(symbol);
  const vs = currency.toLowerCase();
  const res = await getJson<Record<string, Record<string, number>>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${vs}`,
  );
  const price = res[id]?.[vs];
  if (!price) throw new Error(`No CoinGecko price for ${symbol}`);
  return { price, currency: currency.toUpperCase() };
}
