import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { AssetForm, draftFromAsset, draftToAsset } from '@/components/AssetForm';
import { Button, Card, Chips, Field, LabeledChips, Screen, SectionTitle, Txt } from '@/components/ui';
import { parseDecimal } from '@/i18n/format';
import { useAppStore, useData } from '@/store/useAppStore';
import { useColors, useSeriesColors } from '@/theme';

type AssetMode = 'existing' | 'new';

/** Add or edit one holding: an amount of an asset at an account. */
export default function EditHolding() {
  const params = useLocalSearchParams<{ id?: string; institutionId?: string; assetId?: string }>();
  const { t } = useTranslation();
  const c = useColors();
  const series = useSeriesColors();
  const data = useData();
  const upsertHolding = useAppStore((s) => s.upsertHolding);
  const upsertAsset = useAppStore((s) => s.upsertAsset);
  const deleteHolding = useAppStore((s) => s.deleteHolding);
  const existing = data.holdings.find((h) => h.id === params.id);

  const [institutionId, setInstitutionId] = useState(
    existing?.institutionId ?? params.institutionId ?? (data.institutions.length === 1 ? data.institutions[0].id : ''),
  );
  const [assetMode, setAssetMode] = useState<AssetMode>(
    existing || params.assetId || data.assets.length > 0 ? 'existing' : 'new',
  );
  const [assetId, setAssetId] = useState(existing?.assetId ?? params.assetId ?? '');
  const [draft, setDraft] = useState(() => draftFromAsset(undefined, data.settings.baseCurrency));
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : '');
  const [avgCost, setAvgCost] = useState(existing?.avgCost !== undefined ? String(existing.avgCost) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string>();

  if (data.institutions.length === 0) {
    return (
      <Screen>
        <Txt variant="muted">{t('forms.needInstitution')}</Txt>
        <Button title={t('forms.newInstitution')} onPress={() => router.replace('/institution/edit')} />
      </Screen>
    );
  }

  const selectedAsset = assetMode === 'existing' ? data.assets.find((a) => a.id === assetId) : undefined;
  const kind = selectedAsset?.kind ?? (assetMode === 'new' ? draft.kind : undefined);
  const currency = selectedAsset?.currency ?? draft.currency;
  const isCash = kind === 'cash' || kind === 'debt';
  const quantityLabel = kind === 'debt' ? t('forms.amountOwed') : kind === 'cash' ? t('forms.balance') : t('common.quantity');

  const save = () => {
    if (!institutionId) return setError(t('forms.pickInstitution'));
    const qty = parseDecimal(quantity);
    if (qty === undefined || qty < 0) return setError(t('forms.quantityInvalid'));
    let finalAssetId = assetId;
    if (assetMode === 'new') {
      const result = draftToAsset(draft);
      if (!result.asset) return setError(t(result.error!));
      finalAssetId = upsertAsset(result.asset);
    } else if (!selectedAsset) {
      return setError(t('forms.pickAsset'));
    }
    upsertHolding({
      id: existing?.id,
      institutionId,
      assetId: finalAssetId,
      quantity: qty,
      avgCost: isCash ? undefined : parseDecimal(avgCost),
      note: note.trim() || undefined,
    });
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(t('forms.deleteHoldingTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteHolding(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('forms.editHolding') : t('forms.newHolding') }} />
      <LabeledChips
        label={t('forms.institution')}
        options={data.institutions.map((i) => ({ value: i.id, label: i.name, color: series.swatch(i.color) }))}
        value={institutionId}
        onChange={setInstitutionId}
      />

      <SectionTitle>{t('forms.asset')}</SectionTitle>
      {!existing && (
        <Chips
          options={[
            { value: 'existing' as const, label: t('forms.existingAsset') },
            { value: 'new' as const, label: t('forms.createAsset') },
          ]}
          value={assetMode}
          onChange={setAssetMode}
        />
      )}
      {assetMode === 'existing' ? (
        data.assets.length === 0 ? (
          <Txt variant="muted">{t('forms.noAssets')}</Txt>
        ) : (
          <Chips
            options={data.assets.map((a) => ({
              value: a.id,
              label: `${a.name}${a.symbol && a.symbol !== a.name ? ` · ${a.symbol}` : ''} (${a.currency})`,
              color: series.kind(a.kind),
            }))}
            value={assetId}
            onChange={setAssetId}
          />
        )
      ) : (
        <Card>
          <AssetForm draft={draft} onChange={setDraft} />
        </Card>
      )}

      <View style={{ gap: 14 }}>
        <Field
          label={isCash ? `${quantityLabel} (${currency})` : quantityLabel}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />
        {!isCash && kind && (
          <Field
            label={`${t('forms.avgCost', { currency })} — ${t('common.optional')}`}
            value={avgCost}
            onChangeText={setAvgCost}
            keyboardType="decimal-pad"
          />
        )}
        <Field label={`${t('common.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} />
      </View>

      {error && <Txt style={{ color: c.critical }}>{error}</Txt>}
      <Button title={t('common.save')} onPress={save} />
      {existing && <Button title={t('common.delete')} variant="danger" onPress={confirmDelete} />}
    </Screen>
  );
}
