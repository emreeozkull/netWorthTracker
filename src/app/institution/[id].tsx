import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Donut } from '@/components/charts';
import { Button, Card, IconButton, ListRow, Screen, SectionTitle, Txt } from '@/components/ui';
import { usePriceRefresh } from '@/components/usePriceRefresh';
import { allocationBy, netWorth, valueHoldings } from '@/domain/aggregate';
import type { AssetKind } from '@/domain/types';
import { unitPrice } from '@/domain/valuation';
import { useFormat } from '@/i18n/format';
import { useData } from '@/store/useAppStore';
import { useColors, useSeriesColors } from '@/theme';

/** Everything held at one bank or broker. */
export default function InstitutionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const f = useFormat();
  const c = useColors();
  const series = useSeriesColors();
  const data = useData();
  const { refreshControl } = usePriceRefresh();
  const base = data.settings.baseCurrency;
  const institution = data.institutions.find((i) => i.id === id);

  if (!institution) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
      </Screen>
    );
  }

  const filter = { institutionIds: [institution.id] };
  const holdings = valueHoldings(data, base, filter).sort(
    (a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0),
  );
  const nw = netWorth(data, base, filter);
  const slices = allocationBy(data, base, 'kind', filter).map((s) => ({
    key: s.key,
    label: t(`kinds.${s.key}`),
    value: s.value,
    color: series.kind(s.key as AssetKind),
  }));

  return (
    <Screen refreshControl={refreshControl}>
      <Stack.Screen
        options={{
          title: institution.name,
          headerRight: () => (
            <IconButton
              icon="create-outline"
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/institution/edit', params: { id: institution.id } })}
            />
          ),
        }}
      />
      <Card>
        <Txt variant="secondary">{t(`institutionTypes.${institution.type}`)}</Txt>
        <Txt variant="hero" tabular>
          {f.money(nw.total, base)}
        </Txt>
        {nw.missingCount > 0 && (
          <Txt variant="small" style={{ color: c.critical }}>
            {t('dashboard.missing', { count: nw.missingCount })}
          </Txt>
        )}
        {institution.note ? <Txt variant="muted">{institution.note}</Txt> : null}
      </Card>

      {slices.length > 1 && (
        <Card>
          <Donut slices={slices} currency={base} />
        </Card>
      )}

      <SectionTitle>{t('tabs.assets')}</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {holdings.length === 0 && <Txt variant="muted">{t('institutions.detailEmpty')}</Txt>}
        {holdings.map((vh, i) => {
          const isCash = vh.asset.kind === 'cash' || vh.asset.kind === 'debt';
          return (
            <ListRow
              key={vh.holding.id}
              first={i === 0}
              color={series.kind(vh.asset.kind)}
              title={vh.asset.name}
              subtitle={
                isCash
                  ? f.money(vh.holding.quantity, vh.asset.currency)
                  : `${f.number(vh.holding.quantity)} × ${f.money(unitPrice(vh.asset, data.market), vh.asset.currency)}`
              }
              right={vh.value === undefined ? '—' : f.money(vh.value, base)}
              rightSub={t(`kinds.${vh.asset.kind}`)}
              chevron
              onPress={() => router.push({ pathname: '/holding/edit', params: { id: vh.holding.id } })}
            />
          );
        })}
      </Card>
      <Button
        title={t('institutions.addHolding')}
        icon="add"
        onPress={() => router.push({ pathname: '/holding/edit', params: { institutionId: institution.id } })}
      />
    </Screen>
  );
}
