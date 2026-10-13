import { netWorth } from './aggregate';
import type { AppData, Snapshot } from './types';
import { usdRate } from './valuation';

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

/** Replaces today's snapshot (at most one per day) with current totals. */
export function upsertSnapshot(data: AppData, date = localDateKey()): Snapshot[] {
  const values: Record<string, number> = {};
  for (const currency of snapshotCurrencies(data)) {
    const nw = netWorth(data, currency);
    // Skip currencies where nothing could be valued, so history doesn't show false zeros.
    if (nw.missingCount > 0 && nw.assets === 0 && nw.liabilities === 0) continue;
    values[currency] = nw.total;
  }
  const rest = data.snapshots.filter((s) => s.date !== date);
  if (data.holdings.length === 0) return rest;
  return [...rest, { date, values }].sort((a, b) => a.date.localeCompare(b.date));
}
