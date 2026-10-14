/// <reference types="jest" />

import { isDailyFetchDue, unpricedAutoAssets } from '../daily';

describe('isDailyFetchDue', () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

  it('is due when prices were never fetched', () => {
    expect(isDailyFetchDue(undefined, at(2026, 10, 14))).toBe(true);
  });

  it('is not due again on the same local day', () => {
    expect(isDailyFetchDue(at(2026, 10, 14, 0), at(2026, 10, 14, 23))).toBe(false);
  });

  it('is due on the next local day, even if less than 24 hours passed', () => {
    expect(isDailyFetchDue(at(2026, 10, 14, 23), at(2026, 10, 15, 0))).toBe(true);
    expect(isDailyFetchDue(at(2025, 10, 14), at(2026, 10, 14))).toBe(true);
  });
});

describe('unpricedAutoAssets', () => {
  it('returns auto assets with a symbol and no fetched price', () => {
    const assets = [
      { id: 'a', priceMode: 'auto', symbol: 'AAPL' },
      { id: 'b', priceMode: 'auto', symbol: 'MSFT', lastPrice: 400 },
      { id: 'c', priceMode: 'manual', symbol: 'TSLA' },
      { id: 'd', priceMode: 'auto', symbol: '  ' },
    ];
    expect(unpricedAutoAssets(assets).map((a) => a.id)).toEqual(['a']);
  });
});
