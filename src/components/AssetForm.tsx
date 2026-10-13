import { useState } from 'react';
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
import { useAppStore } from '@/store/useAppStore';
import { useSeriesColors } from '@/theme';

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

export function draftFromAsset(asset: Asset | undefined, baseCurrency: string): AssetDraft {
  return {
    kind: asset?.kind ?? 'stock',
    name: asset?.name ?? '',
    symbol: asset?.symbol ?? '',
    currency: asset?.currency ?? baseCurrency,
    goldUnit: asset?.goldUnit ?? 'gram',
    priceMode: asset?.priceMode ?? 'manual',
    manualPrice: asset?.manualPrice !== undefined ? String(asset.manualPrice) : '',
  };
}

const usesPrice = (kind: AssetKind) => kind !== 'cash' && kind !== 'debt';

function modesFor(kind: AssetKind): PriceMode[] {
  if (kind === 'gold') return ['derivedGold', 'manual'];
  if (kind === 'realEstate' || kind === 'other') return ['manual'];
  return ['manual', 'auto'];
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
  if (usesPrice(draft.kind) && priceMode === 'manual' && (manualPrice === undefined || manualPrice < 0)) {
    return { error: 'forms.priceRequired' };
  }
  const symbol = draft.symbol.trim();
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
  onChange: (draft: AssetDraft) => void;
  previous?: Asset;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const series = useSeriesColors();
  const fetchEnabled = useAppStore((s) => s.data.settings.fetchEnabled);
  const [touched, setTouched] = useState(false);
  const set = (patch: Partial<AssetDraft>) => onChange({ ...draft, ...patch });

  const setKind = (kind: AssetKind) => {
    const modes = modesFor(kind);
    set({ kind, priceMode: modes.includes(draft.priceMode) ? draft.priceMode : modes[0] });
  };

  const modes = modesFor(draft.kind);

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
        onChangeText={(name) => set({ name })}
        onBlur={() => setTouched(true)}
        placeholder={draft.kind === 'cash' || draft.kind === 'debt' ? draft.currency : ''}
        error={touched && !draft.name.trim() && usesPrice(draft.kind) ? t('forms.nameRequired') : undefined}
      />
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
              onChange={(priceMode) => set({ priceMode })}
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
            <Field
              label={t('forms.symbol')}
              value={draft.symbol}
              onChangeText={(symbol) => set({ symbol })}
              autoCapitalize="characters"
              autoCorrect={false}
              hint={t('forms.symbolHint')}
            />
          )}
          {draft.priceMode !== 'derivedGold' && (
            <Field
              label={t('forms.unitPrice', { currency: draft.currency })}
              value={draft.manualPrice}
              onChangeText={(manualPrice) => set({ manualPrice })}
              keyboardType="decimal-pad"
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
