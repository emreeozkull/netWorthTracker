import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, ListRow, Screen, SectionTitle, Txt } from '@/components/ui';
import { useHistoryFormat } from '@/components/useHistoryFormat';
import { groupByAccount, snapshotDiff, snapshotPositions, snapshotValue, type Position } from '@/domain/history';
import { useFormat } from '@/i18n/format';
import { useData } from '@/store/useAppStore';
import { useColors, useSeriesColors } from '@/theme';

/** Treats float noise below a cent as no change. */
const isChange = (v: number | undefined): v is number => v !== undefined && Math.abs(v) >= 0.005;

/** Everything held on one snapshot day, grouped by account, with changes vs the previous day. */
export default function HistoryDay() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { t } = useTranslation();
  const f = useFormat();
  const hf = useHistoryFormat();
  const c = useColors();
  const series = useSeriesColors();
  const data = useData();
  const base = data.settings.baseCurrency;

  const index = data.snapshots.findIndex((s) => s.date === date);
  const snapshot = index >= 0 ? data.snapshots[index] : undefined;
  const previous = index > 0 ? data.snapshots[index - 1] : undefined;

  const groups = useMemo(
    () => (snapshot ? groupByAccount(snapshotPositions(snapshot, base)) : []),
    [snapshot, base],
  );
  const diff = useMemo(
    () => (snapshot ? snapshotDiff(previous, snapshot, base) : undefined),
    [previous, snapshot, base],
  );
  const diffByKey = useMemo(() => new Map(diff?.positions.map((p) => [p.key, p])), [diff]);
  const changes = useMemo(() => diff?.positions.filter((p) => p.status !== 'unchanged') ?? [], [diff]);

  const title = date ? f.date(date) : '';

  if (!snapshot || !diff) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Card>
          <Txt variant="muted">{t('history.notFound')}</Txt>
        </Card>
      </Screen>
    );
  }

  const total = snapshotValue(snapshot, base);
  const previousTotal = previous ? snapshotValue(previous, base) : undefined;
  const changeColor = (v: number) => (v >= 0 ? c.good : c.critical);
  const openAsset = (assetId: string) =>
    router.push({ pathname: '/history/asset/[assetId]', params: { assetId } });

  const positionSubtitle = (p: Position) => {
    const amount =
      p.kind === 'cash' || p.kind === 'debt'
        ? f.money(p.quantity, p.currency)
        : `${f.number(p.quantity)} × ${f.money(p.unitPrice, p.currency)}`;
    return p.symbol ? `${p.symbol} · ${amount}` : amount;
  };

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card>
        <Txt variant="secondary">{t('history.netWorth')}</Txt>
        <Txt variant="hero" tabular>
          {f.money(total, base)}
        </Txt>
        {isChange(diff.totalChange) && diff.previousDate && (
          <Txt variant="muted" tabular style={{ color: changeColor(diff.totalChange) }}>
            {hf.change(diff.totalChange, base, previousTotal)}{' '}
            <Txt variant="muted">{t('history.vsPrevious', { date: f.date(diff.previousDate) })}</Txt>
          </Txt>
        )}
        {!snapshot.holdings && <Txt variant="small">{t('history.noDetail')}</Txt>}
      </Card>

      {diff.detailed && diff.previousDate && (
        <>
          <SectionTitle>{t('history.changesSince', { date: f.date(diff.previousDate) })}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {changes.length === 0 && <Txt variant="muted" style={styles.empty}>{t('history.noChanges')}</Txt>}
            {changes.map((d, i) => {
              const status =
                d.status === 'added' ? t('history.added') : d.status === 'removed' ? t('history.removed') : undefined;
              return (
                <ListRow
                  key={d.key}
                  first={i === 0}
                  color={series.kind(d.position.kind)}
                  title={d.position.assetName}
                  subtitle={status ? `${status} · ${d.position.institutionName}` : d.position.institutionName}
                  right={hf.quantity(d.quantityChange, d.position)}
                  rightSub={isChange(d.valueChange) ? hf.change(d.valueChange, base) : undefined}
                  onPress={() => openAsset(d.position.assetId)}
                />
              );
            })}
          </Card>
        </>
      )}

      {groups.map((g) => {
        const accountChange = diff.accounts[g.institutionId];
        return (
          <View key={g.institutionId} style={styles.group}>
            <SectionTitle
              right={
                <View style={styles.groupTotal}>
                  {diff.detailed && isChange(accountChange) && (
                    <Txt variant="small" tabular style={{ color: changeColor(accountChange) }}>
                      {hf.change(accountChange, base)}
                    </Txt>
                  )}
                  <Txt variant="secondary" tabular style={styles.groupTotalText}>
                    {f.money(g.total, base)}
                  </Txt>
                </View>
              }>
              {g.name}
            </SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {g.positions.map((p, i) => {
                const change = diffByKey.get(p.key)?.valueChange;
                return (
                  <ListRow
                    key={p.key}
                    first={i === 0}
                    color={series.kind(p.kind)}
                    title={p.assetName}
                    subtitle={positionSubtitle(p)}
                    right={p.value === undefined ? '—' : f.money(p.value, base)}
                    rightSub={
                      diff.detailed && isChange(change) ? hf.change(change, base) : t(`kinds.${p.kind}`)
                    }
                    chevron
                    onPress={() => openAsset(p.assetId)}
                  />
                );
              })}
              {g.incomplete && <Txt variant="small">{t('common.missingValue')}</Txt>}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 12 },
  group: { gap: 16 },
  groupTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  groupTotalText: { fontWeight: '600' },
});
