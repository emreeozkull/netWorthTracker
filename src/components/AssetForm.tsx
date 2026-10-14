import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  ASSET_KINDS,
  CURRENCIES,
  GOLD_UNITS,
  type Asset,
  type AssetKind,
  type GoldUnit,
  type PriceMode,
} from '@/domain/types';
import { parseDecimal, useFormat } from '@/i18n/format';
import { fetchQuote, quoteInCurrency } from '@/prices';
import type { SymbolMatch } from '@/prices/search';
import { useAppStore } from '@/store/useAppStore';
import { useSeriesColors } from '@/theme';

import { SymbolSuggestions, useSymbolSearch } from './SymbolSuggestions';
import { Field, LabeledChips, Txt } from './ui';

export interface AssetDraft {
  kind: AssetKind;
  name: string;
  symbol: string;
  currency: string;
  goldUnit: GoldUnit;
  priceMode: PriceMode;
  manualPrice: string;
}

const usesPrice = (kind: AssetKind) => kind !== 'cash' && kind !== 'debt';

/** Kinds that have online quotes and symbol search. */
const FETCHABLE_KINDS: readonly AssetKind[] = ['stock', 'etf', 'fund', 'crypto', 'bond'];
const isFetchable = (kind: AssetKind) => FETCHABLE_KINDS.includes(kind);

function modesFor(kind: AssetKind): PriceMode[] {
  if (kind === 'gold') return ['derivedGold', 'manual'];
  if (kind === 'realEstate' || kind === 'other') return ['manual'];
  return ['manual', 'auto'];
}

/** Price mode for a new asset of this kind: online when fetching is enabled and the kind supports it. */
function defaultMode(kind: AssetKind, fetchEnabled: boolean): PriceMode {
  if (fetchEnabled && isFetchable(kind)) return 'auto';
  return modesFor(kind)[0];
}

export function draftFromAsset(asset: Asset | undefined, baseCurrency: string, fetchEnabled = false): AssetDraft {
  const kind = asset?.kind ?? 'stock';
  return {
    kind,
    name: asset?.name ?? '',
    symbol: asset?.symbol ?? '',
    currency: asset?.currency ?? baseCurrency,
    goldUnit: asset?.goldUnit ?? 'gram',
    priceMode: asset?.priceMode ?? defaultMode(kind, fetchEnabled),
    manualPrice: asset?.manualPrice !== undefined ? String(asset.manualPrice) : '',
  };
}

/** Plain decimal string for a fetched price, without exponent notation or trailing zeros. */
function priceToInput(price: number): string {
  const s = price.toFixed(Math.abs(price) >= 1 ? 4 : 8);
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

/** Validates a draft. Returns the asset fields or an i18n error key. */
export function draftToAsset(
  draft: AssetDraft,
  previous?: Asset,
): { asset?: Omit<Asset, 'id'>; error?: string } {
  const name = draft.name.trim() || (draft.kind === 'cash' || draft.kind === 'debt' ? draft.currency : '');
  if (!name) return { error: 'forms.nameRequired' };
  const manualPrice = parseDecimal(draft.manualPrice);
  const priceMode = usesPrice(draft.kind) ? draft.priceMode : 'manual';
  const symbol = draft.symbol.trim();
  if (usesPrice(draft.kind)) {
    // In auto mode the unit price is an optional fallback, but if entered it must be valid.
    const priceInvalid = draft.manualPrice.trim() !== '' && (manualPrice === undefined || manualPrice < 0);
    if (priceInvalid || (priceMode === 'manual' && manualPrice === undefined)) {
      return { error: 'forms.priceRequired' };
    }
    if (priceMode === 'auto' && !symbol) return { error: 'forms.symbolRequired' };
  }
  // A changed symbol or currency invalidates the last fetched price.
  const keepFetched = previous && previous.symbol === symbol && previous.currency === draft.currency;
  return {
    asset: {
      kind: draft.kind,
      name,
      symbol: symbol || undefined,
      currency: draft.currency,
      goldUnit: draft.kind === 'gold' ? draft.goldUnit : undefined,
      priceMode,
      manualPrice: usesPrice(draft.kind) ? manualPrice : undefined,
      lastPrice: keepFetched ? previous.lastPrice : undefined,
      lastPriceAt: keepFetched ? previous.lastPriceAt : undefined,
    },
  };
}

export function AssetForm({
  draft,
  onChange,
  previous,
}: {
  draft: AssetDraft;
  onChange: Dispatch<SetStateAction<AssetDraft>>;
  previous?: Asset;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const series = useSeriesColors();
  const fetchEnabled = useAppStore((s) => s.data.settings.fetchEnabled);
  const baseCurrency = useAppStore((s) => s.data.settings.baseCurrency);
  const [touched, setTouched] = useState(false);
  const [modeTouched, setModeTouched] = useState(false);
  const set = (patch: Partial<AssetDraft>) => onChange((d) => ({ ...d, ...patch }));

  // Symbol suggestions. Queries only leave the device when online prices are enabled.
  const searchable = fetchEnabled && isFetchable(draft.kind);
  const symbolSearch = useSymbolSearch(draft.kind, baseCurrency === 'TRY');
  const [searchField, setSearchField] = useState<'name' | 'symbol'>();
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const quoteRequest = useRef(0);

  const typeInto = (field: 'name' | 'symbol', value: string) => {
    set(field === 'name' ? { name: value } : { symbol: value });
    if (field === 'symbol') {
      // A hand-edited symbol supersedes any quote still loading for a picked suggestion.
      quoteRequest.current += 1;
      setQuoteStatus('idle');
    }
    if (!searchable) return;
    setSearchField(field);
    symbolSearch.search(value);
  };

  const pick = async (match: SymbolMatch) => {
    symbolSearch.clear();
    setSearchField(undefined);
    set({ name: match.name, symbol: match.symbol, kind: match.kind, priceMode: 'auto' });
    const request = ++quoteRequest.current;
    setQuoteStatus('loading');
    try {
      const { market, settings } = useAppStore.getState().data;
      const quote = await fetchQuote({ kind: match.kind, symbol: match.symbol, currency: draft.currency }, settings.finnhubKey);
      // Adopt the listing's currency when we support it; otherwise convert into the current one.
      const known = (CURRENCIES as readonly string[]).includes(quote.currency);
      const currency = known ? quote.currency : draft.currency;
      const price = known ? quote.price : (await quoteInCurrency(quote, currency, market)).price;
      if (request !== quoteRequest.current) return;
      onChange((d) => (d.symbol === match.symbol ? { ...d, currency, manualPrice: priceToInput(price) } : d));
      setQuoteStatus('idle');
    } catch {
      if (request === quoteRequest.current) setQuoteStatus('failed');
    }
  };

  const setKind = (kind: AssetKind) => {
    const modes = modesFor(kind);
    const keep = (previous || modeTouched) && modes.includes(draft.priceMode);
    set({ kind, priceMode: keep ? draft.priceMode : previous ? modes[0] : defaultMode(kind, fetchEnabled) });
    symbolSearch.clear();
    setSearchField(undefined);
  };

  const modes = modesFor(draft.kind);
  const suggestions = (field: 'name' | 'symbol') =>
    searchable && searchField === field ? <SymbolSuggestions state={symbolSearch.state} onPick={pick} /> : null;
  const priceHint =
    quoteStatus === 'loading' ? t('search.fetchingPrice') : quoteStatus === 'failed' ? t('search.priceFailed') : undefined;

  return (
    <View style={{ gap: 14 }}>
      <LabeledChips
        label={t('forms.kind')}
        options={ASSET_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`), color: series.kind(k) }))}
        value={draft.kind}
        onChange={setKind}
      />
      <Field
        label={t('common.name')}
        value={draft.name}
        onChangeText={(name) => typeInto('name', name)}
        onBlur={() => setTouched(true)}
        placeholder={
          draft.kind === 'cash' || draft.kind === 'debt' ? draft.currency : searchable ? t('search.namePlaceholder') : ''
        }
        autoCorrect={searchable ? false : undefined}
        error={touched && !draft.name.trim() && usesPrice(draft.kind) ? t('forms.nameRequired') : undefined}
      />
      {suggestions('name')}
      <LabeledChips
        label={t('common.currency')}
        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        value={draft.currency}
        onChange={(currency) => set({ currency })}
      />
      {draft.kind === 'gold' && (
        <LabeledChips
          label={t('forms.goldUnit')}
          options={GOLD_UNITS.map((u) => ({ value: u, label: t(`goldUnits.${u}`) }))}
          value={draft.goldUnit}
          onChange={(goldUnit) => set({ goldUnit })}
        />
      )}
      {usesPrice(draft.kind) && (
        <>
          {modes.length > 1 && (
            <LabeledChips
              label={t('forms.priceMode')}
              options={modes.map((m) => ({ value: m, label: t(`priceModes.${m}`) }))}
              value={draft.priceMode}
              onChange={(priceMode) => {
                setModeTouched(true);
                set({ priceMode });
              }}
              hint={
                draft.priceMode === 'auto'
                  ? t('forms.autoHint')
                  : draft.priceMode === 'derivedGold'
                    ? t('forms.derivedGoldHint')
                    : undefined
              }
            />
          )}
          {draft.priceMode === 'auto' && (
            <>
              <Field
                label={t('forms.symbol')}
                value={draft.symbol}
                onChangeText={(symbol) => typeInto('symbol', symbol)}
                autoCapitalize="characters"
                autoCorrect={false}
                hint={t('forms.symbolHint')}
              />
              {suggestions('symbol')}
            </>
          )}
          {draft.priceMode !== 'derivedGold' && (
            <Field
              label={
                draft.priceMode === 'auto'
                  ? `${t('forms.unitPrice', { currency: draft.currency })} — ${t('common.optional')}`
                  : t('forms.unitPrice', { currency: draft.currency })
              }
              value={draft.manualPrice}
              onChangeText={(manualPrice) => set({ manualPrice })}
              keyboardType="decimal-pad"
              hint={priceHint ?? (draft.priceMode === 'auto' ? t('forms.fallbackPriceHint') : undefined)}
            />
          )}
          {draft.priceMode === 'auto' && previous?.lastPriceAt && fetchEnabled && (
            <Txt variant="small">
              {f.money(previous.lastPrice, previous.currency)} ·{' '}
              {t('common.updated', { when: f.dateTime(previous.lastPriceAt) })}
            </Txt>
          )}
        </>
      )}
    </View>
  );
}
