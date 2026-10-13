import type { AppData, Asset, AssetKind, Holding, Institution } from './types';
import { holdingValue, unitPrice } from './valuation';

export interface ValuedHolding {
  holding: Holding;
  asset: Asset;
  institution: Institution;
  /** Signed value in base currency; undefined when a price or FX rate is missing. */
  value?: number;
}

export interface AssetRow {
  asset: Asset;
  quantity: number;
  unitPrice?: number;
  value?: number;
  /** True when some holdings of this asset could not be valued. */
  incomplete: boolean;
  parts: ValuedHolding[];
}

export interface InstitutionRow {
  institution: Institution;
  total: number;
  holdingCount: number;
  incomplete: boolean;
}

export interface NetWorth {
  total: number;
  assets: number;
  liabilities: number;
  missingCount: number;
}

export interface Slice {
  key: string;
  value: number;
}

export interface Filter {
  assetIds?: string[];
  institutionIds?: string[];
}

export function valueHoldings(data: AppData, base: string, filter: Filter = {}): ValuedHolding[] {
  const assets = new Map(data.assets.map((a) => [a.id, a]));
  const institutions = new Map(data.institutions.map((i) => [i.id, i]));
  const assetSet = filter.assetIds?.length ? new Set(filter.assetIds) : undefined;
  const instSet = filter.institutionIds?.length ? new Set(filter.institutionIds) : undefined;

  const out: ValuedHolding[] = [];
  for (const holding of data.holdings) {
    const asset = assets.get(holding.assetId);
    const institution = institutions.get(holding.institutionId);
    if (!asset || !institution) continue;
    if (assetSet && !assetSet.has(asset.id)) continue;
    if (instSet && !instSet.has(institution.id)) continue;
    out.push({ holding, asset, institution, value: holdingValue(holding, asset, data.market, base) });
  }
  return out;
}

function sumValues(items: { value?: number }[]): { total: number; incomplete: boolean } {
  let total = 0;
  let incomplete = false;
  for (const item of items) {
    if (item.value === undefined) incomplete = true;
    else total += item.value;
  }
  return { total, incomplete };
}

/** Holdings grouped by asset across institutions — the broker-invariant view. */
export function aggregateByAsset(data: AppData, base: string, filter: Filter = {}): AssetRow[] {
  const groups = new Map<string, ValuedHolding[]>();
  for (const vh of valueHoldings(data, base, filter)) {
    const list = groups.get(vh.asset.id) ?? [];
    list.push(vh);
    groups.set(vh.asset.id, list);
  }

  const rows: AssetRow[] = [];
  for (const parts of groups.values()) {
    const asset = parts[0].asset;
    const { total, incomplete } = sumValues(parts);
    parts.sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
    rows.push({
      asset,
      quantity: parts.reduce((s, p) => s + p.holding.quantity, 0),
      unitPrice: unitPrice(asset, data.market),
      value: incomplete && total === 0 ? undefined : total,
      incomplete,
      parts,
    });
  }
  return rows.sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
}

export function summarizeInstitutions(data: AppData, base: string): InstitutionRow[] {
  const valued = valueHoldings(data, base);
  return data.institutions
    .map((institution) => {
      const own = valued.filter((v) => v.institution.id === institution.id);
      const { total, incomplete } = sumValues(own);
      return { institution, total, holdingCount: own.length, incomplete };
    })
    .sort((a, b) => b.total - a.total);
}

export function netWorth(data: AppData, base: string, filter: Filter = {}): NetWorth {
  let assets = 0;
  let liabilities = 0;
  let missingCount = 0;
  for (const { value } of valueHoldings(data, base, filter)) {
    if (value === undefined) missingCount++;
    else if (value < 0) liabilities += -value;
    else assets += value;
  }
  return { total: assets - liabilities, assets, liabilities, missingCount };
}

export type AllocationKey = 'kind' | 'institution' | 'currency';

/** Positive holdings grouped for allocation charts. Debts are excluded. */
export function allocationBy(
  data: AppData,
  base: string,
  key: AllocationKey,
  filter: Filter = {},
): Slice[] {
  const totals = new Map<string, number>();
  for (const vh of valueHoldings(data, base, filter)) {
    if (vh.value === undefined || vh.value <= 0) continue;
    const k =
      key === 'kind'
        ? vh.asset.kind
        : key === 'institution'
          ? vh.institution.id
          : vh.asset.currency;
    totals.set(k, (totals.get(k) ?? 0) + vh.value);
  }
  return [...totals.entries()]
    .map(([k, value]) => ({ key: k, value }))
    .sort((a, b) => b.value - a.value);
}

export function kindTotals(data: AppData, base: string): Partial<Record<AssetKind, number>> {
  const out: Partial<Record<AssetKind, number>> = {};
  for (const vh of valueHoldings(data, base)) {
    if (vh.value === undefined) continue;
    out[vh.asset.kind] = (out[vh.asset.kind] ?? 0) + vh.value;
  }
  return out;
}
