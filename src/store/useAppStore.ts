import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { demoData } from '@/domain/demo';
import { upsertSnapshot } from '@/domain/snapshot';
import {
  emptyData,
  type AppData,
  type Asset,
  type Holding,
  type Institution,
  type Market,
  type Settings,
} from '@/domain/types';
import { fetchAssetQuote, fetchPrices } from '@/prices';
import { loadData, saveData, wipeData } from '@/storage/repo';

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

interface AppState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  data: AppData;
  locked: boolean;
  refreshing: boolean;

  init(): Promise<void>;
  setLocked(locked: boolean): void;
  upsertInstitution(input: WithOptionalId<Institution>): string;
  deleteInstitution(id: string): void;
  upsertAsset(input: WithOptionalId<Asset>): string;
  deleteAsset(id: string): void;
  upsertHolding(input: WithOptionalId<Holding>): string;
  deleteHolding(id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  updateMarket(patch: Partial<Market>): void;
  /** Fetches FX, gold and all `auto` prices. `silent` skips the pull-to-refresh spinner. Returns errors. */
  refreshPrices(opts?: { silent?: boolean }): Promise<string[]>;
  /** Fetches the quote of one `auto` asset, e.g. right after it was added. Returns an error message on failure. */
  refreshAsset(id: string): Promise<string | undefined>;
  replaceData(data: AppData): void;
  loadDemo(): void;
  wipe(): Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Shared by concurrent refreshes (e.g. the daily auto refresh and a pull-to-refresh). */
let refreshInFlight: Promise<string[]> | undefined;
let pendingSave: AppData | undefined;

function scheduleSave(data: AppData) {
  pendingSave = data;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}

/** Writes any pending change immediately, e.g. before the app goes to the background. */
export async function flushSave(): Promise<void> {
  clearTimeout(saveTimer);
  const data = pendingSave;
  pendingSave = undefined;
  if (!data) return;
  try {
    await saveData(data);
  } catch (e) {
    useAppStore.setState({ error: `Save failed: ${(e as Error).message}` });
  }
}

function upsert<T extends { id: string }>(list: T[], input: WithOptionalId<T>): [T[], string] {
  const id = input.id ?? randomUUID();
  const item = { ...input, id } as T;
  const exists = list.some((x) => x.id === id);
  return [exists ? list.map((x) => (x.id === id ? item : x)) : [...list, item], id];
}

export const useAppStore = create<AppState>((set, get) => {
  /** Applies a change, refreshes today's snapshot and persists. */
  const commit = (mutate: (data: AppData) => AppData) => {
    const next = mutate(get().data);
    const data = { ...next, snapshots: upsertSnapshot(next) };
    set({ data });
    scheduleSave(data);
  };

  return {
    status: 'loading',
    data: emptyData(),
    locked: false,
    refreshing: false,

    async init() {
      try {
        const data = (await loadData()) ?? emptyData();
        set({ data, status: 'ready', locked: data.settings.lockEnabled });
      } catch (e) {
        set({ status: 'error', error: (e as Error).message });
      }
    },

    setLocked(locked) {
      set({ locked });
    },

    upsertInstitution(input) {
      let id = '';
      commit((d) => {
        const [institutions, newId] = upsert(d.institutions, input);
        id = newId;
        return { ...d, institutions };
      });
      return id;
    },

    deleteInstitution(id) {
      commit((d) => ({
        ...d,
        institutions: d.institutions.filter((i) => i.id !== id),
        holdings: d.holdings.filter((h) => h.institutionId !== id),
      }));
    },

    upsertAsset(input) {
      let id = '';
      commit((d) => {
        const [assets, newId] = upsert(d.assets, input);
        id = newId;
        return { ...d, assets };
      });
      return id;
    },

    deleteAsset(id) {
      commit((d) => ({
        ...d,
        assets: d.assets.filter((a) => a.id !== id),
        holdings: d.holdings.filter((h) => h.assetId !== id),
      }));
    },

    upsertHolding(input) {
      let id = '';
      commit((d) => {
        const [holdings, newId] = upsert(d.holdings, input);
        id = newId;
        return { ...d, holdings };
      });
      return id;
    },

    deleteHolding(id) {
      commit((d) => ({ ...d, holdings: d.holdings.filter((h) => h.id !== id) }));
    },

    updateSettings(patch) {
      commit((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    },

    updateMarket(patch) {
      commit((d) => ({ ...d, market: { ...d.market, ...patch } }));
    },

    async refreshPrices(opts) {
      if (!get().data.settings.fetchEnabled) return [];
      const run = async () => {
        const update = await fetchPrices(get().data);
        const succeeded =
          update.market.ratesUpdatedAt === update.fetchedAt ||
          update.market.goldUpdatedAt === update.fetchedAt ||
          Object.keys(update.prices).length > 0;
        commit((d) => ({
          ...d,
          // Keep any manual edits made while the fetch was in flight.
          market: {
            ...update.market,
            manualRates: d.market.manualRates,
            manualGoldGram: d.market.manualGoldGram,
            // A fully failed attempt (e.g. offline) doesn't count, so the daily refresh retries.
            pricesFetchedAt: succeeded ? update.fetchedAt : d.market.pricesFetchedAt,
          },
          assets: d.assets.map((a) =>
            update.prices[a.id] !== undefined
              ? { ...a, lastPrice: update.prices[a.id], lastPriceAt: update.fetchedAt }
              : a,
          ),
        }));
        return update.errors;
      };
      if (!opts?.silent) set({ refreshing: true });
      try {
        refreshInFlight ??= run().finally(() => {
          refreshInFlight = undefined;
        });
        return await refreshInFlight;
      } finally {
        if (!opts?.silent) set({ refreshing: false });
      }
    },

    async refreshAsset(id) {
      const { data } = get();
      const asset = data.assets.find((a) => a.id === id);
      if (!data.settings.fetchEnabled || !asset || asset.priceMode !== 'auto' || !asset.symbol?.trim()) {
        return undefined;
      }
      try {
        const { price, usdRates } = await fetchAssetQuote(asset, data.market, data.settings.finnhubKey);
        const fetchedAt = Date.now();
        commit((d) => ({
          ...d,
          market: usdRates ? { ...d.market, usdRates: { ...d.market.usdRates, ...usdRates } } : d.market,
          // Skip if the asset was edited to a different symbol or currency in the meantime.
          assets: d.assets.map((a) =>
            a.id === id && a.symbol === asset.symbol && a.currency === asset.currency
              ? { ...a, lastPrice: price, lastPriceAt: fetchedAt }
              : a,
          ),
        }));
        return undefined;
      } catch (e) {
        return `${asset.symbol}: ${(e as Error).message}`;
      }
    },

    replaceData(data) {
      commit(() => data);
    },

    loadDemo() {
      commit((d) => demoData(d.settings));
    },

    async wipe() {
      clearTimeout(saveTimer);
      pendingSave = undefined;
      await wipeData();
      set({ data: emptyData(), locked: false, error: undefined });
    },
  };
});

export const useData = () => useAppStore((s) => s.data);
export const useSettings = () => useAppStore((s) => s.data.settings);
