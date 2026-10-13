import { getJson } from './http';

/** ECB reference rates, keyless. Returns units of each currency per 1 USD. */
export async function frankfurterUsdRates(): Promise<Record<string, number>> {
  const res = await getJson<{ rates: Record<string, number> }>(
    'https://api.frankfurter.dev/v1/latest?base=USD',
  );
  return { ...res.rates, USD: 1 };
}
