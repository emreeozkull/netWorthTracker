/// <reference types="jest" />
/// <reference types="node" />

import { GRAMS_PER_TROY_OUNCE } from '../gold';
import {
  accountSeries,
  assetIdentity,
  assetInfo,
  assetSeries,
  convertAt,
  groupByAccount,
  historyAssets,
  historyInstitutions,
  snapshotDiff,
  snapshotPositions,
  snapshotValue,
  withChanges,
} from '../history';
import { parseAppData } from '../schema';
import { upsertSnapshot } from '../snapshot';
import { emptyData, type AppData, type Snapshot } from '../types';

function portfolio(): AppData {
  const data = emptyData();
  data.market.manualRates = { TRY: 40, EUR: 0.9 };
  data.market.usdRates = { USD: 1, TRY: 35 };
  data.market.goldUsdPerOunce = GRAMS_PER_TROY_OUNCE * 100; // 100 USD per gram
  data.institutions = [
    { id: 'bank', name: 'Bank', type: 'bank', color: '#000' },
    { id: 'a', name: 'Broker A', type: 'broker', color: '#000' },
  ];
  data.assets = [
    { id: 'aapl', kind: 'stock', name: 'Apple', symbol: 'AAPL', currency: 'USD', priceMode: 'manual', manualPrice: 200 },
    { id: 'try', kind: 'cash', name: 'TRY', currency: 'TRY', priceMode: 'manual' },
    { id: 'gram', kind: 'gold', name: 'Gram', currency: 'TRY', goldUnit: 'gram', priceMode: 'derivedGold' },
    { id: 'loan', kind: 'debt', name: 'Loan', currency: 'TRY', priceMode: 'manual' },
  ];
  data.holdings = [
    { id: 'h1', institutionId: 'a', assetId: 'aapl', quantity: 10 },
    { id: 'h3', institutionId: 'bank', assetId: 'try', quantity: 4000 },
    { id: 'h4', institutionId: 'bank', assetId: 'gram', quantity: 2 },
    { id: 'h5', institutionId: 'bank', assetId: 'loan', quantity: 2000 },
  ];
  return data;
}

function snapshotOn(data: AppData, date: string): Snapshot {
  return upsertSnapshot(data, date).find((s) => s.date === date)!;
}

describe('rich snapshots', () => {
  it('records per-holding detail with denormalized names and effective rates', () => {
    const s = snapshotOn(portfolio(), '2026-01-01');
    expect(s.holdings).toHaveLength(4);
    const aapl = s.holdings!.find((h) => h.holdingId === 'h1')!;
    expect(aapl).toMatchObject({
      institutionName: 'Broker A',
      assetName: 'Apple',
      symbol: 'AAPL',
      kind: 'stock',
      currency: 'USD',
      quantity: 10,
      unitPrice: 200,
      value: 2000,
    });
    const loan = s.holdings!.find((h) => h.holdingId === 'h5')!;
    expect(loan.value).toBe(-2000);
    // Manual override (40) wins over the fetched rate (35).
    expect(s.usdRates).toMatchObject({ USD: 1, TRY: 40, EUR: 0.9 });
  });

  it('keeps holdings it cannot price, without a value', () => {
    const data = portfolio();
    data.market.goldUsdPerOunce = undefined;
    const gram = snapshotOn(data, '2026-01-01').holdings!.find((h) => h.assetId === 'gram')!;
    expect(gram.unitPrice).toBeUndefined();
    expect(gram.value).toBeUndefined();
  });

  it('parses old snapshots without detail and round-trips new ones', () => {
    const data = portfolio();
    const old = { ...data, snapshots: [{ date: '2025-12-31', values: { USD: 1 } }] };
    expect(parseAppData(JSON.parse(JSON.stringify(old))).snapshots[0].holdings).toBeUndefined();
    const fresh = { ...data, snapshots: upsertSnapshot(old, '2026-01-01') };
    expect(parseAppData(JSON.parse(JSON.stringify(fresh)))).toEqual(fresh);
  });
});

describe('history helpers', () => {
  it('converts with the rates recorded that day', () => {
    const s = snapshotOn(portfolio(), '2026-01-01');
    expect(convertAt(s, 4000, 'TRY', 'USD')).toBe(100);
    expect(convertAt(s, 100, 'USD', 'EUR')).toBeCloseTo(90);
    expect(convertAt(s, 1, 'XYZ', 'USD')).toBeUndefined();
    expect(convertAt({ date: 'x', values: {} }, 1, 'TRY', 'USD')).toBeUndefined();
  });

  it('values the portfolio and single accounts in any base currency', () => {
    const s = snapshotOn(portfolio(), '2026-01-01');
    // 2000 AAPL + 100 cash + 200 gold - 50 loan
    expect(snapshotValue(s, 'USD')).toBeCloseTo(2250);
    expect(snapshotValue(s, 'USD', 'a')).toBeCloseTo(2000);
    expect(snapshotValue(s, 'TRY', 'bank')).toBeCloseTo(4000 + 8000 - 2000);
    expect(snapshotValue(s, 'USD', 'missing')).toBeUndefined();
    // Falls back to holdings when the stored totals lack the currency.
    expect(snapshotValue({ ...s, values: {} }, 'EUR')).toBeCloseTo(2250 * 0.9);
  });

  it('builds account series, skipping days without data', () => {
    const data = portfolio();
    const old: Snapshot = { date: '2025-12-31', values: { USD: 1000 } };
    let snapshots = upsertSnapshot({ ...data, snapshots: [old] }, '2026-01-01');
    data.assets[0].manualPrice = 210;
    snapshots = upsertSnapshot({ ...data, snapshots }, '2026-01-02');

    expect(accountSeries(snapshots, 'USD').map((p) => p.value)).toEqual([1000, 2250, 2350]);
    expect(accountSeries(snapshots, 'USD', 'a')).toEqual([
      { date: '2026-01-01', value: 2000 },
      { date: '2026-01-02', value: 2100 },
    ]);
    const rows = withChanges(accountSeries(snapshots, 'USD', 'a'));
    expect(rows[0].change).toBeUndefined();
    expect(rows[1].change).toBeCloseTo(100);
  });

  it('lists accounts from history, preferring current names', () => {
    const data = portfolio();
    const snapshots = upsertSnapshot(data, '2026-01-01');
    const current = [{ ...data.institutions[1], name: 'Broker A (renamed)' }];
    expect(historyInstitutions(snapshots, current)).toEqual(
      expect.arrayContaining([
        { id: 'a', name: 'Broker A (renamed)' },
        { id: 'bank', name: 'Bank' },
      ]),
    );
  });

  it('groups positions by account with subtotals', () => {
    const data = portfolio();
    data.holdings.push({ id: 'h6', institutionId: 'a', assetId: 'aapl', quantity: 5 });
    const s = snapshotOn(data, '2026-01-01');
    const positions = snapshotPositions(s, 'USD');
    expect(positions.find((p) => p.key === 'a|aapl')).toMatchObject({ quantity: 15, value: 3000 });
    const groups = groupByAccount(positions);
    expect(groups.map((g) => [g.institutionId, g.total])).toEqual([
      ['a', 3000],
      ['bank', 250],
    ]);
  });
});

describe('snapshotDiff', () => {
  it('reports quantity changes, new and removed positions', () => {
    const data = portfolio();
    const before = snapshotOn(data, '2026-01-01');
    data.holdings[0].quantity = 15; // bought 5 AAPL
    data.holdings = data.holdings.filter((h) => h.id !== 'h4'); // sold the gold
    data.assets.push({ id: 'btc', kind: 'crypto', name: 'Bitcoin', currency: 'USD', priceMode: 'manual', manualPrice: 1000 });
    data.holdings.push({ id: 'h7', institutionId: 'a', assetId: 'btc', quantity: 0.5 });
    const after = snapshotOn(data, '2026-01-02');

    const diff = snapshotDiff(before, after, 'USD');
    expect(diff.detailed).toBe(true);
    expect(diff.previousDate).toBe('2026-01-01');
    expect(diff.totalChange).toBeCloseTo(1000 + 500 - 200);

    const byKey = new Map(diff.positions.map((p) => [p.key, p]));
    expect(byKey.get('a|aapl')).toMatchObject({ status: 'changed', quantityChange: 5, valueChange: 1000 });
    expect(byKey.get('a|btc')).toMatchObject({ status: 'added', quantityChange: 0.5, valueChange: 500 });
    expect(byKey.get('bank|gram')).toMatchObject({ status: 'removed', quantityChange: -2 });
    expect(byKey.get('bank|gram')!.valueChange).toBeCloseTo(-200);
    expect(byKey.get('bank|try')!.status).toBe('unchanged');
    expect(diff.accounts.a).toBeCloseTo(1500);
    expect(diff.accounts.bank).toBeCloseTo(-200);
  });

  it('separates price moves from quantity changes', () => {
    const data = portfolio();
    const before = snapshotOn(data, '2026-01-01');
    data.assets[0].manualPrice = 250;
    const diff = snapshotDiff(before, snapshotOn(data, '2026-01-02'), 'USD');
    const aapl = diff.positions.find((p) => p.key === 'a|aapl')!;
    expect(aapl.status).toBe('unchanged');
    expect(aapl.valueChange).toBeCloseTo(500);
  });

  it('degrades gracefully for old snapshots and the first day', () => {
    const current = snapshotOn(portfolio(), '2026-01-01');
    const old: Snapshot = { date: '2025-12-31', values: { USD: 2000 } };
    const diff = snapshotDiff(old, current, 'USD');
    expect(diff.detailed).toBe(false);
    expect(diff.totalChange).toBeCloseTo(250);
    expect(diff.positions).toEqual([]);
    expect(snapshotDiff(undefined, current, 'USD')).toMatchObject({ detailed: false, positions: [] });
  });
});

describe('asset history', () => {
  function history(): { data: AppData; snapshots: Snapshot[] } {
    const data = portfolio();
    data.institutions.push({ id: 'b', name: 'Broker B', type: 'broker', color: '#000' });
    data.holdings.push({ id: 'h6', institutionId: 'b', assetId: 'aapl', quantity: 5 });
    const old: Snapshot = { date: '2025-12-31', values: { USD: 1 } };
    let snapshots = upsertSnapshot({ ...data, snapshots: [old] }, '2026-01-01');
    // Day 2: bought 5 more at A, price up 10%.
    data.holdings[0].quantity = 15;
    data.assets[0].manualPrice = 220;
    snapshots = upsertSnapshot({ ...data, snapshots }, '2026-01-02');
    return { data, snapshots };
  }

  it('sums an asset across accounts per day with a per-account breakdown', () => {
    const { snapshots } = history();
    const series = assetSeries(snapshots, 'USD', 'aapl');
    expect(series.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02']); // pre-detail day skipped
    expect(series[0]).toMatchObject({ quantity: 15, unitPrice: 200, value: 3000, currency: 'USD' });
    expect(series[0].accounts).toEqual([
      { institutionId: 'a', institutionName: 'Broker A', quantity: 10, value: 2000 },
      { institutionId: 'b', institutionName: 'Broker B', quantity: 5, value: 1000 },
    ]);
    expect(series[1]).toMatchObject({ quantity: 20, unitPrice: 220, value: 4400, quantityChange: 5, valueChange: 1400 });
    expect(series[1].priceChange).toBeCloseTo(0.1);
    // Values convert into any base with that day's rates.
    expect(assetSeries(snapshots, 'TRY', 'aapl')[0].value).toBeCloseTo(3000 * 40);
  });

  it('follows a deleted and re-created asset by its ticker, and marks the day it was sold out', () => {
    const { data, snapshots: start } = history();
    let snapshots = start;
    // Day 3: everything sold, asset deleted.
    const withoutAapl: AppData = {
      ...data,
      assets: data.assets.filter((a) => a.id !== 'aapl'),
      holdings: data.holdings.filter((h) => h.assetId !== 'aapl'),
    };
    snapshots = upsertSnapshot({ ...withoutAapl, snapshots }, '2026-01-03');
    snapshots = upsertSnapshot({ ...withoutAapl, snapshots }, '2026-01-04');
    // Day 5: re-created under a new id with the same ticker.
    const recreated: AppData = {
      ...withoutAapl,
      assets: [...withoutAapl.assets, { ...data.assets[0], id: 'aapl2', name: 'Apple Inc.' }],
      holdings: [...withoutAapl.holdings, { id: 'h9', institutionId: 'a', assetId: 'aapl2', quantity: 1 }],
    };
    snapshots = upsertSnapshot({ ...recreated, snapshots }, '2026-01-05');

    const series = assetSeries(snapshots, 'USD', 'aapl2');
    expect(series.map((p) => [p.date, p.quantity])).toEqual([
      ['2026-01-01', 15],
      ['2026-01-02', 20],
      ['2026-01-03', 0],
      ['2026-01-05', 1],
    ]);
    expect(series[2].unitPrice).toBeUndefined();
    // The deleted id resolves to the same line.
    expect(assetSeries(snapshots, 'USD', 'aapl')).toHaveLength(4);

    const assets = historyAssets(snapshots, 'USD', recreated.assets);
    const apple = assets.filter((a) => a.symbol === 'AAPL');
    expect(apple).toHaveLength(1);
    expect(apple[0]).toMatchObject({ id: 'aapl2', name: 'Apple Inc.', quantity: 1, closed: false });
  });

  it('matches unpriced assets without a ticker by kind and name, and lists closed ones last', () => {
    const { data, snapshots: start } = history();
    const noGold = { ...data, holdings: data.holdings.filter((h) => h.assetId !== 'gram') };
    const snapshots = upsertSnapshot({ ...noGold, snapshots: start }, '2026-01-03');
    const assets = historyAssets(snapshots, 'USD', noGold.assets.filter((a) => a.id !== 'gram'));
    const gram = assets[assets.length - 1];
    expect(gram).toMatchObject({ id: 'gram', name: 'Gram', closed: true, lastDate: '2026-01-02', quantity: 2 });
    expect(assetIdentity({ kind: 'gold', currency: 'TRY', name: ' Gram ' })).toBe(
      assetIdentity({ kind: 'gold', currency: 'TRY', name: 'gram' }),
    );
    // Deleted assets keep the name stored in snapshots.
    expect(assetInfo(snapshots, 'gram', [])).toMatchObject({ name: 'Gram', kind: 'gold', currency: 'TRY' });
  });
});
