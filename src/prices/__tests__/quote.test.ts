/// <reference types="jest" />
/// <reference types="node" />

import { emptyData } from '@/domain/types';

import { fetchAssetQuote, quoteInCurrency } from '..';

describe('quoteInCurrency', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('converts with known rates without touching the network', async () => {
    const fn = jest.fn();
    global.fetch = fn as unknown as typeof fetch;
    const market = { ...emptyData().market, manualRates: { TRY: 40 } };
    expect(await quoteInCurrency({ price: 10, currency: 'USD' }, 'TRY', market)).toEqual({ price: 400 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('fetches a missing rate and returns it for the market', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 7.8, currency: 'HKD' } }] } }),
    })) as unknown as typeof fetch;
    const result = await quoteInCurrency({ price: 78, currency: 'HKD' }, 'USD', emptyData().market);
    expect(result.price).toBeCloseTo(10);
    expect(result.usdRates).toEqual({ HKD: 7.8 });
  });
});

describe('fetchAssetQuote', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('quotes a BIST stock in its own currency', async () => {
    const fn = jest.fn(async () => ({
      ok: true,
      json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 312.5, currency: 'TRY' } }] } }),
    }));
    global.fetch = fn as unknown as typeof fetch;
    const result = await fetchAssetQuote({ kind: 'stock', symbol: 'THYAO.IS', currency: 'TRY' }, emptyData().market);
    expect(result).toEqual({ price: 312.5 });
    expect((fn.mock.calls[0] as unknown[])[0]).toContain('/chart/THYAO.IS');
  });

  it('rejects assets without a symbol', async () => {
    await expect(fetchAssetQuote({ kind: 'stock', symbol: ' ', currency: 'USD' }, emptyData().market)).rejects.toThrow();
  });
});
