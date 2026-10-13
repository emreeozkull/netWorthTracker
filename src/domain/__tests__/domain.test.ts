/// <reference types="jest" />
/// <reference types="node" />

import { aggregateByAsset, allocationBy, netWorth, summarizeInstitutions } from '../aggregate';
import { demoData } from '../demo';
import { GRAMS_PER_TROY_OUNCE, PURE_GOLD_GRAMS } from '../gold';
import { parseAppData } from '../schema';
import { upsertSnapshot } from '../snapshot';
import { emptyData, type AppData } from '../types';
import { convert, goldGramPrice, unitPrice } from '../valuation';

function portfolio(): AppData {
  const data = emptyData();
  data.market.manualRates = { TRY: 40, EUR: 0.9 };
  data.market.goldUsdPerOunce = GRAMS_PER_TROY_OUNCE * 100; // 100 USD per gram
  data.institutions = [
    { id: 'bank', name: 'Bank', type: 'bank', color: '#000' },
    { id: 'a', name: 'Broker A', type: 'broker', color: '#000' },
    { id: 'b', name: 'Broker B', type: 'broker', color: '#000' },
  ];
  data.assets = [
    { id: 'aapl', kind: 'stock', name: 'Apple', symbol: 'AAPL', currency: 'USD', priceMode: 'manual', manualPrice: 200 },
    { id: 'try', kind: 'cash', name: 'TRY', currency: 'TRY', priceMode: 'manual' },
    { id: 'gram', kind: 'gold', name: 'Gram', currency: 'TRY', goldUnit: 'gram', priceMode: 'derivedGold' },
    { id: 'loan', kind: 'debt', name: 'Loan', currency: 'TRY', priceMode: 'manual' },
  ];
  data.holdings = [
    { id: 'h1', institutionId: 'a', assetId: 'aapl', quantity: 10 },
    { id: 'h2', institutionId: 'b', assetId: 'aapl', quantity: 5 },
    { id: 'h3', institutionId: 'bank', assetId: 'try', quantity: 4000 },
    { id: 'h4', institutionId: 'bank', assetId: 'gram', quantity: 2 },
    { id: 'h5', institutionId: 'bank', assetId: 'loan', quantity: 2000 },
  ];
  return data;
}

describe('valuation', () => {
  it('converts through USD and returns undefined for unknown currencies', () => {
    const { market } = portfolio();
    expect(convert(100, 'USD', 'TRY', market)).toBe(4000);
    expect(convert(4000, 'TRY', 'EUR', market)).toBeCloseTo(90);
    expect(convert(1, 'XYZ', 'USD', market)).toBeUndefined();
    expect(convert(5, 'XYZ', 'XYZ', market)).toBe(5);
  });

  it('prefers manual rates over fetched ones', () => {
    const { market } = portfolio();
    market.usdRates = { TRY: 1 };
    expect(convert(1, 'USD', 'TRY', market)).toBe(40);
  });

  it('derives gold coin prices from pure gold content', () => {
    const data = portfolio();
    expect(goldGramPrice(data.market, 'TRY')).toBeCloseTo(4000);
    const ceyrek = { ...data.assets[2], goldUnit: 'ceyrek' as const };
    expect(unitPrice(ceyrek, data.market)).toBeCloseTo(4000 * PURE_GOLD_GRAMS.ceyrek);
    expect(PURE_GOLD_GRAMS.ceyrek).toBeCloseTo(1.603, 3);
  });

  it('uses a manual gram price when set', () => {
    const data = portfolio();
    data.market.manualGoldGram = { price: 5000, currency: 'TRY' };
    expect(goldGramPrice(data.market, 'TRY')).toBe(5000);
  });

  it('falls back to the manual price for auto assets without a fetched price', () => {
    const data = portfolio();
    const asset = { ...data.assets[0], priceMode: 'auto' as const };
    expect(unitPrice(asset, data.market)).toBe(200);
    expect(unitPrice({ ...asset, lastPrice: 210 }, data.market)).toBe(210);
  });
});

describe('aggregation', () => {
  it('sums the same asset across brokers (broker-invariant view)', () => {
    const rows = aggregateByAsset(portfolio(), 'USD');
    const aapl = rows.find((r) => r.asset.id === 'aapl')!;
    expect(aapl.quantity).toBe(15);
    expect(aapl.value).toBe(3000);
    expect(aapl.parts.map((p) => [p.institution.id, p.value])).toEqual([
      ['a', 2000],
      ['b', 1000],
    ]);
  });

  it('filters by selected assets and institutions', () => {
    const data = portfolio();
    expect(netWorth(data, 'USD', { assetIds: ['aapl'] }).total).toBe(3000);
    expect(netWorth(data, 'USD', { institutionIds: ['b'] }).total).toBe(500 * 2);
    const rows = aggregateByAsset(data, 'USD', { institutionIds: ['a'] });
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(10);
  });

  it('subtracts debt from net worth', () => {
    // 3000 AAPL + 100 cash + 200 gold - 50 loan (all USD)
    const nw = netWorth(portfolio(), 'USD');
    expect(nw.assets).toBeCloseTo(3300);
    expect(nw.liabilities).toBeCloseTo(50);
    expect(nw.total).toBeCloseTo(3250);
    expect(nw.missingCount).toBe(0);
  });

  it('reports holdings that cannot be valued instead of counting them as zero', () => {
    const data = portfolio();
    data.market.manualRates = {};
    const nw = netWorth(data, 'USD');
    expect(nw.total).toBe(3000);
    expect(nw.missingCount).toBe(3);
    const bank = summarizeInstitutions(data, 'USD').find((r) => r.institution.id === 'bank')!;
    expect(bank.incomplete).toBe(true);
  });

  it('computes per-institution totals and allocation without debts', () => {
    const data = portfolio();
    const bank = summarizeInstitutions(data, 'TRY').find((r) => r.institution.id === 'bank')!;
    expect(bank.total).toBeCloseTo(4000 + 8000 - 2000);
    expect(bank.holdingCount).toBe(3);
    const byKind = allocationBy(data, 'USD', 'kind');
    expect(byKind.map((s) => s.key)).toEqual(['stock', 'gold', 'cash']);
  });
});

describe('snapshots', () => {
  it('keeps one snapshot per day with values per currency', () => {
    const data = portfolio();
    let snapshots = upsertSnapshot(data, '2026-01-01');
    snapshots = upsertSnapshot({ ...data, snapshots }, '2026-01-01');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].values.USD).toBeCloseTo(3250);
    expect(snapshots[0].values.TRY).toBeCloseTo(130000);
    snapshots = upsertSnapshot({ ...data, snapshots }, '2026-01-02');
    expect(snapshots.map((s) => s.date)).toEqual(['2026-01-01', '2026-01-02']);
  });
});

describe('schema', () => {
  it('round-trips demo data and fills missing settings', () => {
    const demo = demoData();
    expect(parseAppData(JSON.parse(JSON.stringify(demo)))).toEqual(demo);
    const partial = { ...demo, settings: { baseCurrency: 'USD' } };
    expect(parseAppData(partial).settings.lockTimeoutSec).toBe(60);
  });

  it('rejects malformed data and newer versions', () => {
    expect(() => parseAppData({ version: 1, holdings: 'nope' })).toThrow();
    expect(() => parseAppData({ ...emptyData(), version: 999 })).toThrow(/newer/);
  });
});
