export const ASSET_KINDS = [
  'cash',
  'stock',
  'etf',
  'fund',
  'gold',
  'crypto',
  'bond',
  'realEstate',
  'debt',
  'other',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const INSTITUTION_TYPES = ['bank', 'broker', 'exchange', 'wallet', 'other'] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const GOLD_UNITS = ['gram', 'ounce', 'ceyrek', 'yarim', 'tam', 'cumhuriyet'] as const;
export type GoldUnit = (typeof GOLD_UNITS)[number];

export const PRICE_MODES = ['manual', 'auto', 'derivedGold'] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const CURRENCIES = [
  'TRY',
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CNY',
] as const;

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  color: string;
  note?: string;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  /** Ticker used for automatic price lookups, e.g. AAPL, THYAO.IS, BTC. */
  symbol?: string;
  /** Currency the unit price is quoted in. */
  currency: string;
  goldUnit?: GoldUnit;
  priceMode: PriceMode;
  manualPrice?: number;
  lastPrice?: number;
  lastPriceAt?: number;
}

export interface Holding {
  id: string;
  institutionId: string;
  assetId: string;
  quantity: number;
  avgCost?: number;
  note?: string;
}

/** Daily net worth, stored per currency so history survives base-currency changes. */
export interface Snapshot {
  date: string;
  values: Record<string, number>;
  /** Per-holding detail for the day. Absent on snapshots recorded before detailed history existed. */
  holdings?: SnapshotHolding[];
  /** Effective units of currency per 1 USD that day (manual overrides applied), for converting `holdings`. */
  usdRates?: Record<string, number>;
}

/**
 * One position as it stood on a snapshot day. Names are copied so history survives
 * renames and deletions of the account or asset.
 */
export interface SnapshotHolding {
  holdingId: string;
  institutionId: string;
  institutionName: string;
  assetId: string;
  assetName: string;
  symbol?: string;
  kind: AssetKind;
  /** Currency of `unitPrice` and `value`. */
  currency: string;
  quantity: number;
  /** Unit price in `currency` used that day; undefined when no price was known. */
  unitPrice?: number;
  /** Signed value in `currency` (debts negative); undefined when it couldn't be valued. */
  value?: number;
}

export interface Settings {
  baseCurrency: string;
  language: 'system' | 'en' | 'tr';
  theme: 'system' | 'light' | 'dark';
  fetchEnabled: boolean;
  finnhubKey?: string;
  lockEnabled: boolean;
  lockTimeoutSec: number;
}

export interface Market {
  /** Units of currency per 1 USD, as fetched. */
  usdRates: Record<string, number>;
  ratesUpdatedAt?: number;
  /** User-entered overrides, units of currency per 1 USD. Take precedence over fetched rates. */
  manualRates: Record<string, number>;
  goldUsdPerOunce?: number;
  goldUpdatedAt?: number;
  /** User-entered price of 1 gram of pure gold. Takes precedence over the fetched spot price. */
  manualGoldGram?: { price: number; currency: string };
  /** Last successful online price refresh; drives the once-a-day automatic refresh. */
  pricesFetchedAt?: number;
}

export interface AppData {
  version: number;
  institutions: Institution[];
  assets: Asset[];
  holdings: Holding[];
  snapshots: Snapshot[];
  settings: Settings;
  market: Market;
}

export const DATA_VERSION = 1;

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    institutions: [],
    assets: [],
    holdings: [],
    snapshots: [],
    settings: {
      baseCurrency: 'TRY',
      language: 'system',
      theme: 'system',
      fetchEnabled: true,
      lockEnabled: false,
      lockTimeoutSec: 60,
    },
    market: { usdRates: { USD: 1 }, manualRates: {} },
  };
}
