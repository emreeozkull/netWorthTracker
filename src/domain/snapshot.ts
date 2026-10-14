import { netWorth, valueHoldings } from './aggregate';
import type { AppData, Snapshot, SnapshotHolding } from './types';
import { unitPrice, usdRate } from './valuation';

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Currencies worth recording: the base, USD/EUR/TRY, and every asset currency we can convert. */
function snapshotCurrencies(data: AppData): string[] {
  const set = new Set<string>(['USD', 'EUR', 'TRY', data.settings.baseCurrency]);
  for (const a of data.assets) set.add(a.currency);
  return [...set].filter((c) => usdRate(data.market, c) !== undefined || c === data.settings.baseCurrency);
}

/** Trims float noise so stored history stays compact. */
function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Every holding as it stands now, valued in its asset's own currency. */
function snapshotHoldings(data: AppData): SnapshotHolding[] {
  return valueHoldings(data, data.settings.baseCurrency).map(({ holding, asset, institution }) => {
    const price = unitPrice(asset, data.market);
    const row: SnapshotHolding = {
      holdingId: holding.id,
      institutionId: institution.id,
      institutionName: institution.name,
      assetId: asset.id,
      assetName: asset.name,
      kind: asset.kind,
      currency: asset.currency,
      quantity: holding.quantity,
    };
    if (asset.symbol) row.symbol = asset.symbol;
    if (price !== undefined) {
      row.unitPrice = price;
      const value = holding.quantity * price;
      row.value = round(asset.kind === 'debt' ? -value : value);
    }
    return row;
  });
}

/** Effective units-per-USD for the given currencies, honoring manual overrides like valuation does. */
function effectiveRates(data: AppData, currencies: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of currencies) {
    const rate = usdRate(data.market, c);
    if (rate !== undefined) out[c] = rate;
  }
  return out;
}

/** Replaces today's snapshot (at most one per day) with current totals and per-holding detail. */
export function upsertSnapshot(data: AppData, date = localDateKey()): Snapshot[] {
  const currencies = snapshotCurrencies(data);
  const values: Record<string, number> = {};
  for (const currency of currencies) {
    const nw = netWorth(data, currency);
    // Skip currencies where nothing could be valued, so history doesn't show false zeros.
    if (nw.missingCount > 0 && nw.assets === 0 && nw.liabilities === 0) continue;
    values[currency] = nw.total;
  }
  const rest = data.snapshots.filter((s) => s.date !== date);
  if (data.holdings.length === 0) return rest;
  const snapshot: Snapshot = {
    date,
    values,
    holdings: snapshotHoldings(data),
    usdRates: effectiveRates(data, currencies),
  };
  return [...rest, snapshot].sort((a, b) => a.date.localeCompare(b.date));
}
