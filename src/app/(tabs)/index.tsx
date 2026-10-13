import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Donut, foldSlices, LineChart } from '@/components/charts';
import { Banner, Button, Card, Chips, ListRow, Screen, SectionTitle, Txt } from '@/components/ui';
import { usePriceRefresh } from '@/components/usePriceRefresh';
import { allocationBy, netWorth } from '@/domain/aggregate';
import { localDateKey } from '@/domain/snapshot';
import type { AssetKind } from '@/domain/types';
import { useFormat } from '@/i18n/format';
import { useAppStore, useData } from '@/store/useAppStore';
import { useColors, useSeriesColors } from '@/theme';

export default function Dashboard() {
  const { t } = useTranslation();
  const f = useFormat();
  const c = useColors();
  const series = useSeriesColors();
  const data = useData();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const { refreshControl, errors } = usePriceRefresh();
  const base = data.settings.baseCurrency;

  const nw = useMemo(() => netWorth(data, base), [data, base]);

  const byKind = useMemo(
    () =>
      foldSlices(
        allocationBy(data, base, 'kind').map((s) => ({
          key: s.key,
          label: t(`kinds.${s.key}`),
          value: s.value,
          color: series.kind(s.key as AssetKind),
        })),
        t('common.other'),
      ),
    [data, base, t, series],
  );

  const byInstitution = useMemo(() => {
    const names = new Map(data.institutions.map((i) => [i.id, i]));
    return foldSlices(
      allocationBy(data, base, 'institution').map((s) => ({
        key: s.key,
        label: names.get(s.key)?.name ?? '?',
        value: s.value,
        color: series.swatch(names.get(s.key)?.color ?? '#898781'),
      })),
      t('common.other'),
    );
  }, [data, base, t, series]);

  const history = useMemo(
    () =>
      data.snapshots
        .filter((s) => s.values[base] !== undefined)
        .map((s) => ({ date: s.date, value: s.values[base] })),
    [data.snapshots, base],
  );

  const previous = useMemo(() => {
    const today = localDateKey();
    return [...history].reverse().find((p) => p.date < today);
  }, [history]);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>([base, 'TRY', 'USD', 'EUR', ...data.assets.map((a) => a.currency)]);
    return [...set].map((v) => ({ value: v, label: v }));
  }, [base, data.assets]);

  if (data.holdings.length === 0) {
    return (
      <Screen>
        <Card style={{ gap: 12, paddingVertical: 24 }}>
          <Txt variant="title">{t('dashboard.emptyTitle')}</Txt>
          <Txt variant="secondary">{t('dashboard.emptyBody')}</Txt>
        </Card>
        {data.institutions.length === 0 ? (
          <Button title={t('dashboard.addInstitution')} icon="business" onPress={() => router.push('/institution/edit')} />
        ) : (
          <Button title={t('forms.newHolding')} icon="add" onPress={() => router.push('/holding/edit')} />
        )}
        <Button title={t('dashboard.loadDemo')} variant="secondary" icon="sparkles" onPress={loadDemo} />
      </Screen>
    );
  }

  const change = previous ? nw.total - previous.value : undefined;

  return (
    <Screen refreshControl={refreshControl}>
      <Card>
        <Txt variant="secondary">{t('dashboard.netWorth')}</Txt>
        <Txt variant="hero" tabular>
          {f.money(nw.total, base)}
        </Txt>
        {change !== undefined && previous && (
          <Txt variant="muted" tabular style={{ color: change >= 0 ? c.good : c.critical }}>
            {change >= 0 ? '▲' : '▼'} {f.money(Math.abs(change), base)}
            {previous.value !== 0 ? ` (${f.percent(change / Math.abs(previous.value))})` : ''}{' '}
            <Txt variant="muted">{t('dashboard.since', { date: f.date(previous.date) })}</Txt>
          </Txt>
        )}
        <View style={styles.split}>
          <View style={{ flex: 1 }}>
            <Txt variant="muted">{t('dashboard.assets')}</Txt>
            <Txt variant="heading" tabular>
              {f.money(nw.assets, base)}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="muted">{t('dashboard.liabilities')}</Txt>
            <Txt variant="heading" tabular>
              {f.money(nw.liabilities, base)}
            </Txt>
          </View>
        </View>
        <Chips
          scroll
          options={currencyOptions}
          value={base}
          onChange={(baseCurrency) => updateSettings({ baseCurrency })}
        />
      </Card>

      {nw.missingCount > 0 && (
        <Banner
          action={<Button title={t('dashboard.fixRates')} variant="ghost" onPress={() => router.push('/rates')} />}>
          {t('dashboard.missing', { count: nw.missingCount })}
        </Banner>
      )}

      {errors.length > 0 && (
        <Banner>
          {t('dashboard.refreshErrors')} {errors.join('; ')}
        </Banner>
      )}

      {byKind.length > 0 && (
        <>
          <SectionTitle>{t('dashboard.byKind')}</SectionTitle>
          <Card>
            <Donut slices={byKind} currency={base} />
          </Card>
        </>
      )}

      {byInstitution.length > 0 && (
        <>
          <SectionTitle>{t('dashboard.byInstitution')}</SectionTitle>
          <Card>
            <Donut slices={byInstitution} currency={base} />
          </Card>
        </>
      )}

      <SectionTitle>{t('dashboard.history')}</SectionTitle>
      <Card>
        {history.length >= 2 ? (
          <LineChart points={history} currency={base} />
        ) : (
          <Txt variant="muted">{t('dashboard.historyHint')}</Txt>
        )}
      </Card>

      {nw.liabilities > 0 && <SectionTitle>{t('dashboard.liabilities')}</SectionTitle>}
      {nw.liabilities > 0 && (
        <Card>
          {data.holdings
            .map((h) => ({ h, a: data.assets.find((a) => a.id === h.assetId) }))
            .filter((x) => x.a?.kind === 'debt')
            .map(({ h, a }, i) => (
              <ListRow
                key={h.id}
                first={i === 0}
                title={a!.name}
                subtitle={data.institutions.find((x) => x.id === h.institutionId)?.name}
                right={`−${f.money(h.quantity, a!.currency)}`}
                onPress={() => router.push({ pathname: '/holding/edit', params: { id: h.id } })}
              />
            ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 4 },
});
