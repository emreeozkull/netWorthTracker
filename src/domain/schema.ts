import { z } from 'zod';

import {
  ASSET_KINDS,
  DATA_VERSION,
  GOLD_UNITS,
  INSTITUTION_TYPES,
  PRICE_MODES,
  emptyData,
  type AppData,
} from './types';

const rates = z.record(z.string(), z.number());

const institution = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(INSTITUTION_TYPES),
  color: z.string(),
  note: z.string().optional(),
});

const asset = z.object({
  id: z.string(),
  kind: z.enum(ASSET_KINDS),
  name: z.string(),
  symbol: z.string().optional(),
  currency: z.string(),
  goldUnit: z.enum(GOLD_UNITS).optional(),
  priceMode: z.enum(PRICE_MODES),
  manualPrice: z.number().optional(),
  lastPrice: z.number().optional(),
  lastPriceAt: z.number().optional(),
});

const holding = z.object({
  id: z.string(),
  institutionId: z.string(),
  assetId: z.string(),
  quantity: z.number(),
  avgCost: z.number().optional(),
  note: z.string().optional(),
});

const snapshot = z.object({ date: z.string(), values: rates });

const settings = z.object({
  baseCurrency: z.string(),
  language: z.enum(['system', 'en', 'tr']),
  theme: z.enum(['system', 'light', 'dark']),
  fetchEnabled: z.boolean(),
  finnhubKey: z.string().optional(),
  lockEnabled: z.boolean(),
  lockTimeoutSec: z.number(),
});

const market = z.object({
  usdRates: rates,
  ratesUpdatedAt: z.number().optional(),
  manualRates: rates,
  goldUsdPerOunce: z.number().optional(),
  goldUpdatedAt: z.number().optional(),
  manualGoldGram: z.object({ price: z.number(), currency: z.string() }).optional(),
});

export const appDataSchema = z.object({
  version: z.number(),
  institutions: z.array(institution),
  assets: z.array(asset),
  holdings: z.array(holding),
  snapshots: z.array(snapshot),
  settings,
  market,
});

/** Upgrades older payloads to the current shape. Add a step here whenever DATA_VERSION bumps. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > DATA_VERSION) {
    throw new Error(`Data version ${version} is newer than this app supports (${DATA_VERSION}).`);
  }
  const defaults = emptyData();
  return {
    ...raw,
    version: DATA_VERSION,
    settings: { ...defaults.settings, ...(raw.settings as object) },
    market: { ...defaults.market, ...(raw.market as object) },
  };
}

export function parseAppData(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid data');
  return appDataSchema.parse(migrate(raw as Record<string, unknown>)) as AppData;
}
