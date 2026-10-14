import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chips, ListRow, Screen, SectionTitle, Txt } from '@/components/ui';
import { usePriceRefresh } from '@/components/usePriceRefresh';
import { aggregateByAsset, netWorth, type AssetRow } from '@/domain/aggregate';
import { useFormat } from '@/i18n/format';
import { useData } from '@/store/useAppStore';
import { useColors, useSeriesColors } from '@/theme';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Broker-invariant view: each asset summed across every account that holds it. */
export default function AssetsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const series = useSeriesColors();
  const data = useData();
  const { refreshControl } = usePriceRefresh();
  const base = data.settings.baseCurrency;
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Drop selections that point to deleted items.
  const validAssetIds = assetIds.filter((id) => data.assets.some((a) => a.id === id));
  const validInstIds = institutionIds.filter((id) => data.institutions.some((i) => i.id === id));
  const filter = { assetIds: validAssetIds, institutionIds: validInstIds };

  const rows = aggregateByAsset(data, base, filter);
  const total = netWorth(data, base, filter);

  const heldAssets = data.assets.filter((a) => data.holdings.some((h) => h.assetId === a.id));
  const filtered = validAssetIds.length > 0 || validInstIds.length > 0;

  if (data.holdings.length === 0) {
    return (
      <Screen>
        <Txt variant="muted">{t('assets.empty')}</Txt>
        <Button title={t('forms.newHolding')} icon="add" onPress={() => router.push('/holding/edit')} />
      </Screen>
    );
  }

  return (
    <Screen refreshControl={refreshControl}>
      <Card>
        <Txt variant="secondary">{t('assets.selection')}</Txt>
        <Txt variant="hero" tabular>
          {f.money(total.total, base)}
        </Txt>
        {!filtered && <Txt variant="small">{t('assets.selectionHint')}</Txt>}
      </Card>

      <SectionTitle
        right={
          filtered ? (
            <Pressable
              onPress={() => {
                setAssetIds([]);
                setInstitutionIds([]);
              }}
              hitSlop={8}>
              <Txt variant="muted">{t('common.clear')}</Txt>
            </Pressable>
          ) : undefined
        }>
        {t('assets.filterAssets')}
      </SectionTitle>
      <Chips
        scroll
        options={heldAssets.map((a) => ({ value: a.id, label: a.symbol || a.name, color: series.kind(a.kind) }))}
        value={validAssetIds}
        onChange={(id) => setAssetIds(toggle(validAssetIds, id))}
      />
      <SectionTitle>{t('assets.filterInstitutions')}</SectionTitle>
      <Chips
        scroll
        options={data.institutions.map((i) => ({ value: i.id, label: i.name, color: series.swatch(i.color) }))}
        value={validInstIds}
        onChange={(id) => setInstitutionIds(toggle(validInstIds, id))}
      />

      <View style={{ gap: 10 }}>
        {rows.map((row) => (
          <AssetCard
            key={row.asset.id}
            row={row}
            base={base}
            selectionTotal={total.assets}
            expanded={expanded === row.asset.id}
            onToggle={() => setExpanded(expanded === row.asset.id ? null : row.asset.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

function AssetCard({
  row,
  base,
  selectionTotal,
  expanded,
  onToggle,
}: {
  row: AssetRow;
  base: string;
  selectionTotal: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const c = useColors();
  const series = useSeriesColors();
  const { asset } = row;
  const isCash = asset.kind === 'cash' || asset.kind === 'debt';
  const qty = isCash ? f.money(row.quantity, asset.currency) : `${f.number(row.quantity)} × ${f.money(row.unitPrice, asset.currency)}`;

  return (
    <Card style={{ paddingVertical: 12 }}>
      <Pressable onPress={onToggle} onLongPress={() => router.push({ pathname: '/asset/edit', params: { id: asset.id } })}>
        <View style={styles.head}>
          <View style={[styles.kindBar, { backgroundColor: series.kind(asset.kind) }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" numberOfLines={1}>
              {asset.name}
              {asset.symbol ? <Txt variant="muted"> {asset.symbol}</Txt> : null}
            </Txt>
            <Txt variant="muted" tabular numberOfLines={1}>
              {qty}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Txt variant="heading" tabular style={asset.kind === 'debt' ? { color: c.critical } : undefined}>
              {row.value === undefined ? '—' : f.money(row.value, base)}
            </Txt>
            <Txt variant="small" tabular>
              {row.value !== undefined && row.value > 0 && selectionTotal > 0
                ? t('assets.share', { percent: f.percent(row.value / selectionTotal) })
                : t(`kinds.${asset.kind}`)}
            </Txt>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
        </View>
        {row.incomplete && (
          <Txt variant="small" style={{ color: c.critical }}>
            {t('common.missingValue')}
          </Txt>
        )}
        {!expanded && (
          <Txt variant="small">{t('assets.acrossAccounts', { count: row.parts.length })}</Txt>
        )}
      </Pressable>
      {expanded && (
        <View>
          {row.parts.map((p, i) => (
            <ListRow
              key={p.holding.id}
              first={i === 0}
              color={series.swatch(p.institution.color)}
              title={p.institution.name}
              subtitle={isCash ? undefined : f.number(p.holding.quantity)}
              right={p.value === undefined ? '—' : f.money(p.value, base)}
              rightSub={
                row.value && p.value !== undefined ? f.percent(p.value / row.value) : undefined
              }
              onPress={() => router.push({ pathname: '/holding/edit', params: { id: p.holding.id } })}
              chevron
            />
          ))}
          <Button
            title={t('history.viewHistory')}
            icon="time-outline"
            variant="ghost"
            onPress={() => router.push({ pathname: '/history/asset/[assetId]', params: { assetId: asset.id } })}
          />
          <Button
            title={t('assets.editAsset')}
            variant="ghost"
            onPress={() => router.push({ pathname: '/asset/edit', params: { id: asset.id } })}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
