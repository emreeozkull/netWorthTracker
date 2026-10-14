import type { Asset, AssetKind, Institution, Snapshot, SnapshotHolding } from './types';

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface HistoryRow extends HistoryPoint {
  /** Change vs the previous point of the same series; undefined for the first one. */
  change?: number;
  previousValue?: number;
}

/** One asset within one account on a snapshot day; holdings of the same pair are merged. */
export interface Position {
  key: string;
  institutionId: string;
  institutionName: string;
  assetId: string;
  assetName: string;
  symbol?: string;
  kind: AssetKind;
  currency: string;
  quantity: number;
  /** In `currency`. */
  unitPrice?: number;
  /** Signed value in the requested base currency; undefined when it couldn't be valued or converted. */
  value?: number;
  incomplete: boolean;
}

export interface AccountGroup {
  institutionId: string;
  name: string;
  total: number;
  incomplete: boolean;
  positions: Position[];
}

export type PositionStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface PositionDiff {
  key: string;
  status: PositionStatus;
  /** Current position, or the previous one for removed positions. */
  position: Position;
  previous?: Position;
  quantityChange: number;
  /** Change in base currency, when both sides could be valued. */
  valueChange?: number;
}

export interface SnapshotDiff {
  previousDate?: string;
  totalChange?: number;
  /** False when either side lacks per-holding detail (older snapshots). */
  detailed: boolean;
  positions: PositionDiff[];
  /** Account value change in base currency, keyed by institution id. */
  accounts: Record<string, number>;
}

/** Units of `currency` per USD as recorded on the snapshot. */
function snapshotRate(snapshot: Snapshot, currency: string): number | undefined {
  if (currency === 'USD') return 1;
  const rate = snapshot.usdRates?.[currency];
  return rate && rate > 0 ? rate : undefined;
}

/** Converts an amount using the exchange rates recorded on that day. */
export function convertAt(snapshot: Snapshot, amount: number, from: string, to: string): number | undefined {
  if (from === to) return amount;
  const fromRate = snapshotRate(snapshot, from);
  const toRate = snapshotRate(snapshot, to);
  if (fromRate === undefined || toRate === undefined) return undefined;
  return (amount / fromRate) * toRate;
}

/** Signed value of a snapshot holding in `base`, using that day's rates. */
export function holdingValueIn(snapshot: Snapshot, holding: SnapshotHolding, base: string): number | undefined {
  if (holding.value === undefined) return undefined;
  return convertAt(snapshot, holding.value, holding.currency, base);
}

function sumHoldings(snapshot: Snapshot, holdings: SnapshotHolding[], base: string): number | undefined {
  let total = 0;
  let valued = 0;
  for (const h of holdings) {
    const v = holdingValueIn(snapshot, h, base);
    if (v === undefined) continue;
    total += v;
    valued++;
  }
  return valued > 0 ? total : undefined;
}

/**
 * Value of the whole portfolio, or of one account, on a snapshot day in `base`.
 * Undefined when the day has no data for it (e.g. an account that didn't exist yet,
 * or an older snapshot without per-holding detail).
 */
export function snapshotValue(snapshot: Snapshot, base: string, institutionId?: string): number | undefined {
  if (!institutionId) {
    const stored = snapshot.values[base];
    if (stored !== undefined) return stored;
    return snapshot.holdings ? sumHoldings(snapshot, snapshot.holdings, base) : undefined;
  }
  if (!snapshot.holdings) return undefined;
  const own = snapshot.holdings.filter((h) => h.institutionId === institutionId);
  return own.length ? sumHoldings(snapshot, own, base) : undefined;
}

/** Value over time for the whole portfolio (no id) or one account. Days without data are skipped. */
export function accountSeries(snapshots: Snapshot[], base: string, institutionId?: string): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const s of snapshots) {
    const value = snapshotValue(s, base, institutionId);
    if (value !== undefined) out.push({ date: s.date, value });
  }
  return out;
}

/** Annotates each point with its change vs the previous point. */
export function withChanges(points: HistoryPoint[]): HistoryRow[] {
  return points.map((p, i) => {
    const prev = points[i - 1];
    return prev ? { ...p, change: p.value - prev.value, previousValue: prev.value } : { ...p };
  });
}

/** Accounts that appear in history, named by their current name when they still exist. */
export function historyInstitutions(
  snapshots: Snapshot[],
  current: Institution[],
): { id: string; name: string }[] {
  const names = new Map<string, string>();
  // Later snapshots win, so a renamed account shows its latest recorded name.
  for (const s of snapshots) for (const h of s.holdings ?? []) names.set(h.institutionId, h.institutionName);
  for (const i of current) if (names.has(i.id)) names.set(i.id, i.name);
  return [...names.entries()].map(([id, name]) => ({ id, name }));
}

/** Holdings of a snapshot merged per account + asset and valued in `base`. */
export function snapshotPositions(snapshot: Snapshot, base: string): Position[] {
  const map = new Map<string, Position>();
  for (const h of snapshot.holdings ?? []) {
    const key = `${h.institutionId}|${h.assetId}`;
    const value = holdingValueIn(snapshot, h, base);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += h.quantity;
      if (value === undefined) existing.incomplete = true;
      else existing.value = (existing.value ?? 0) + value;
      existing.unitPrice ??= h.unitPrice;
      continue;
    }
    map.set(key, {
      key,
      institutionId: h.institutionId,
      institutionName: h.institutionName,
      assetId: h.assetId,
      assetName: h.assetName,
      symbol: h.symbol,
      kind: h.kind,
      currency: h.currency,
      quantity: h.quantity,
      unitPrice: h.unitPrice,
      value,
      incomplete: value === undefined,
    });
  }
  return [...map.values()].sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
}

/** Positions grouped by account, largest account first. */
export function groupByAccount(positions: Position[]): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();
  for (const p of positions) {
    let g = groups.get(p.institutionId);
    if (!g) {
      g = { institutionId: p.institutionId, name: p.institutionName, total: 0, incomplete: false, positions: [] };
      groups.set(p.institutionId, g);
    }
    g.positions.push(p);
    if (p.value !== undefined) g.total += p.value;
    if (p.incomplete) g.incomplete = true;
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function quantityChanged(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** What changed between two snapshot days: total, account values and positions. */
export function snapshotDiff(previous: Snapshot | undefined, current: Snapshot, base: string): SnapshotDiff {
  const result: SnapshotDiff = { detailed: false, positions: [], accounts: {} };
  if (!previous) return result;
  result.previousDate = previous.date;
  const prevTotal = snapshotValue(previous, base);
  const currTotal = snapshotValue(current, base);
  if (prevTotal !== undefined && currTotal !== undefined) result.totalChange = currTotal - prevTotal;
  if (!previous.holdings || !current.holdings) return result;
  result.detailed = true;

  const before = new Map(snapshotPositions(previous, base).map((p) => [p.key, p]));
  const after = snapshotPositions(current, base);
  const addAccount = (id: string, delta: number | undefined) => {
    if (delta !== undefined) result.accounts[id] = (result.accounts[id] ?? 0) + delta;
  };

  for (const p of after) {
    const prev = before.get(p.key);
    before.delete(p.key);
    if (!prev) {
      result.positions.push({ key: p.key, status: 'added', position: p, quantityChange: p.quantity, valueChange: p.value });
      addAccount(p.institutionId, p.value);
      continue;
    }
    const valueChange = p.value !== undefined && prev.value !== undefined ? p.value - prev.value : undefined;
    result.positions.push({
      key: p.key,
      status: quantityChanged(p.quantity, prev.quantity) ? 'changed' : 'unchanged',
      position: p,
      previous: prev,
      quantityChange: p.quantity - prev.quantity,
      valueChange,
    });
    addAccount(p.institutionId, valueChange);
  }
  for (const prev of before.values()) {
    const valueChange = prev.value === undefined ? undefined : -prev.value;
    result.positions.push({
      key: prev.key,
      status: 'removed',
      position: prev,
      previous: prev,
      quantityChange: -prev.quantity,
      valueChange,
    });
    addAccount(prev.institutionId, valueChange);
  }
  return result;
}

/** Identity fields shared by live assets and snapshot holdings. */
interface AssetLike {
  kind: AssetKind;
  currency: string;
  symbol?: string;
  name: string;
}

/**
 * Stable identity of an asset across snapshots, so an asset that was deleted and re-created
 * (new id) still lines up: by ticker when it has one, otherwise by kind + name.
 */
export function assetIdentity(a: AssetLike): string {
  const symbol = a.symbol?.trim().toUpperCase();
  return symbol
    ? `s:${symbol}:${a.currency}`
    : `n:${a.kind}:${a.currency}:${a.name.trim().toLowerCase()}`;
}

const holdingIdentity = (h: SnapshotHolding) =>
  assetIdentity({ kind: h.kind, currency: h.currency, symbol: h.symbol, name: h.assetName });

export interface AssetAccountShare {
  institutionId: string;
  institutionName: string;
  quantity: number;
  /** Signed value in base; undefined when it couldn't be valued. */
  value?: number;
}

export interface AssetHistoryPoint {
  date: string;
  /** Total across every account; 0 on a day it was no longer held. */
  quantity: number;
  /** In `currency`; undefined when unpriced or not held. */
  unitPrice?: number;
  currency: string;
  /** Signed total in base; undefined when nothing could be valued. */
  value?: number;
  incomplete: boolean;
  accounts: AssetAccountShare[];
  /** Changes vs the previous point. */
  quantityChange?: number;
  valueChange?: number;
  /** Relative price change, e.g. 0.05 for +5%. */
  priceChange?: number;
}

export interface AssetSummary {
  /** Id to open its history with: the live asset's id when it still exists. */
  id: string;
  identity: string;
  name: string;
  symbol?: string;
  kind: AssetKind;
  currency: string;
  /** Latest recorded day it was held. */
  lastDate: string;
  quantity: number;
  value?: number;
  /** True when it isn't in the latest detailed snapshot (sold out or deleted). */
  closed: boolean;
}

/**
 * Groups asset ids that refer to the same asset over time: holdings join a group when they
 * share an asset id or an identity with it, so renamed assets (same id) and re-created ones
 * (same ticker, or same kind + name) stay together. Returns asset id → group number.
 */
function assetGroups(snapshots: Snapshot[]): Map<string, number> {
  const byId = new Map<string, number>();
  const byIdentity = new Map<string, number>();
  let next = 0;
  for (const s of snapshots) {
    for (const h of s.holdings ?? []) {
      const identity = holdingIdentity(h);
      const g = byId.get(h.assetId) ?? byIdentity.get(identity) ?? next++;
      byId.set(h.assetId, g);
      byIdentity.set(identity, g);
    }
  }
  return byId;
}

/** Name and identity fields for an asset, preferring the live asset, else its latest snapshot record. */
export function assetInfo(
  snapshots: Snapshot[],
  assetId: string,
  current: Asset[],
): { name: string; symbol?: string; kind: AssetKind; currency: string } | undefined {
  const live = current.find((a) => a.id === assetId);
  if (live) return { name: live.name, symbol: live.symbol, kind: live.kind, currency: live.currency };
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const h = snapshots[i].holdings?.find((x) => x.assetId === assetId);
    if (h) return { name: h.assetName, symbol: h.symbol, kind: h.kind, currency: h.currency };
  }
  return undefined;
}

/**
 * One asset over time, summed across all accounts. Matches by asset id, falling back to
 * ticker (or kind + name) so re-created assets continue the same line. Snapshots without
 * per-holding detail are skipped; days before it was first held are omitted, and of each run
 * of days it wasn't held only the first is kept (as a zero point).
 */
export function assetSeries(snapshots: Snapshot[], base: string, assetId: string): AssetHistoryPoint[] {
  const groups = assetGroups(snapshots);
  const group = groups.get(assetId);
  const matches = (h: SnapshotHolding) =>
    h.assetId === assetId || (group !== undefined && groups.get(h.assetId) === group);
  const out: AssetHistoryPoint[] = [];

  for (const s of snapshots) {
    if (!s.holdings) continue;
    const own = s.holdings.filter(matches);
    if (own.length === 0) {
      const last = out[out.length - 1];
      if (last && last.quantity !== 0) {
        out.push({ date: s.date, quantity: 0, currency: last.currency, value: 0, incomplete: false, accounts: [] });
      }
      continue;
    }
    const accounts = new Map<string, AssetAccountShare>();
    let quantity = 0;
    let value = 0;
    let valued = 0;
    let unitPrice: number | undefined;
    for (const h of own) {
      quantity += h.quantity;
      unitPrice ??= h.unitPrice;
      const v = holdingValueIn(s, h, base);
      if (v !== undefined) {
        value += v;
        valued++;
      }
      const acc = accounts.get(h.institutionId) ?? {
        institutionId: h.institutionId,
        institutionName: h.institutionName,
        quantity: 0,
      };
      acc.quantity += h.quantity;
      if (v !== undefined) acc.value = (acc.value ?? 0) + v;
      accounts.set(h.institutionId, acc);
    }
    out.push({
      date: s.date,
      quantity,
      unitPrice,
      currency: own[0].currency,
      value: valued > 0 ? value : undefined,
      incomplete: valued < own.length,
      accounts: [...accounts.values()].sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0)),
    });
  }

  for (let i = 1; i < out.length; i++) {
    const p = out[i];
    const prev = out[i - 1];
    p.quantityChange = p.quantity - prev.quantity;
    if (p.value !== undefined && prev.value !== undefined) p.valueChange = p.value - prev.value;
    if (p.unitPrice !== undefined && prev.unitPrice) p.priceChange = p.unitPrice / prev.unitPrice - 1;
  }
  return out;
}

/** Every asset that appears in detailed history (held now or not), with its latest recorded total. */
export function historyAssets(snapshots: Snapshot[], base: string, current: Asset[] = []): AssetSummary[] {
  const detailed = snapshots.filter((s) => s.holdings);
  const latestDate = detailed[detailed.length - 1]?.date;
  const live = new Map(current.map((a) => [a.id, a]));
  const groupOf = assetGroups(detailed);
  const groups = new Map<number, { ids: Set<string>; latest?: AssetSummary }>();

  for (const s of detailed) {
    const today = new Map<number, AssetSummary>();
    for (const h of s.holdings!) {
      const g = groupOf.get(h.assetId)!;
      const group = groups.get(g) ?? { ids: new Set<string>() };
      group.ids.add(h.assetId);
      groups.set(g, group);

      const v = holdingValueIn(s, h, base);
      const entry = today.get(g);
      if (entry) {
        entry.quantity += h.quantity;
        if (v !== undefined) entry.value = (entry.value ?? 0) + v;
        continue;
      }
      today.set(g, {
        id: h.assetId,
        identity: holdingIdentity(h),
        name: h.assetName,
        symbol: h.symbol,
        kind: h.kind,
        currency: h.currency,
        lastDate: s.date,
        quantity: h.quantity,
        value: v,
        closed: false,
      });
    }
    // Later days overwrite earlier ones, so each asset ends with its latest record.
    for (const [g, entry] of today) groups.get(g)!.latest = entry;
  }

  return [...groups.values()]
    .flatMap(({ ids, latest }) => {
      if (!latest) return [];
      const liveId = live.has(latest.id) ? latest.id : [...ids].find((id) => live.has(id));
      const asset = liveId ? live.get(liveId) : undefined;
      return [
        {
          ...latest,
          id: liveId ?? latest.id,
          name: asset?.name ?? latest.name,
          symbol: asset ? asset.symbol : latest.symbol,
          closed: latest.lastDate !== latestDate,
        },
      ];
    })
    .sort((a, b) => Number(a.closed) - Number(b.closed) || Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
}
