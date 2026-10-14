import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LineChart, type LinePoint, type ValueFormatter } from '@/components/charts';
import { Button, Card, Chips, Screen, SectionTitle, Txt } from '@/components/ui';
import { useHistoryFormat } from '@/components/useHistoryFormat';
import { assetInfo, assetSeries, type AssetHistoryPoint } from '@/domain/history';
import type { AssetKind } from '@/domain/types';
import { useFormat } from '@/i18n/format';
import { useData } from '@/store/useAppStore';
import { useColors, useSeriesColors } from '@/theme';

type Metric = 'value' | 'quantity' | 'price';

const PAGE = 60;

const isChange = (v: number | undefined): v is number => v !== undefined && Math.abs(v) >= 0.005;
const isCashLike = (kind: AssetKind) => kind === 'cash' || kind === 'debt';

/** One asset over time, summed across every account that held it. */
export default function AssetHistory() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const { t } = useTranslation();
  const f = useFormat();
  const series = useSeriesColors();
  const data = useData();
  const base = data.settings.baseCurrency;
  const [metric, setMetric] = useState<Metric>('value');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const info = useMemo(
    () => (assetId ? assetInfo(data.snapshots, assetId, data.assets) : undefined),
    [data.snapshots, data.assets, assetId],
  );
  const points = useMemo(
    () => (assetId ? assetSeries(data.snapshots, base, assetId) : []),
    [data.snapshots, base, assetId],
  );
  const days = useMemo(() => [...points].reverse(), [points]);

  const cashLike = info ? isCashLike(info.kind) : false;
  const currency = info?.currency ?? base;
  const activeMetric: Metric = cashLike && metric === 'price' ? 'value' : metric;

  const chart = useMemo((): { points: LinePoint[]; format: ValueFormatter } => {
    if (activeMetric === 'quantity') {
      return {
        points: points.map((p) => ({ date: p.date, value: p.quantity })),
        format: cashLike
          ? (v, compact) => f.money(v, currency, { compact })
          : (v, compact) => f.number(v, compact ? 2 : 6),
      };
    }
    if (activeMetric === 'price') {
      return {
        points: points.flatMap((p) => (p.unitPrice === undefined ? [] : [{ date: p.date, value: p.unitPrice }])),
        format: (v, compact) => f.money(v, currency, { compact }),
      };
    }
    return {
      points: points.flatMap((p) => (p.value === undefined ? [] : [{ date: p.date, value: p.value }])),
      format: (v, compact) => f.money(v, base, { compact }),
    };
  }, [activeMetric, points, cashLike, currency, base, f]);

  const metricOptions = useMemo(
    () =>
      [
        { value: 'value' as const, label: t('history.metricValue') },
        { value: 'quantity' as const, label: t('history.metricQuantity') },
        { value: 'price' as const, label: t('history.metricPrice') },
      ].filter((o) => !(cashLike && o.value === 'price')),
    [t, cashLike],
  );

  const title = info?.name ?? '';

  if (!info || points.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Card>
          <Txt variant="muted">{t('history.assetNotFound')}</Txt>
        </Card>
      </Screen>
    );
  }

  const latest = points[points.length - 1];
  const held = latest.quantity !== 0;
  const lastHeld = held ? undefined : [...points].reverse().find((p) => p.quantity !== 0);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card>
        <View style={styles.headRow}>
          <View style={[styles.kindBar, { backgroundColor: series.kind(info.kind) }]} />
          <Txt variant="secondary" style={{ flex: 1 }}>
            {info.symbol ? `${info.symbol} · ` : ''}
            {t(`kinds.${info.kind}`)}
          </Txt>
        </View>
        <Txt variant="hero" tabular>
          {f.money(latest.value, base)}
        </Txt>
        {held ? (
          <Txt variant="muted" tabular>
            <QuantityLine point={latest} kind={info.kind} />
            {' · '}
            {t('assets.acrossAccounts', { count: latest.accounts.length })}
          </Txt>
        ) : (
          <Txt variant="muted">
            {t('history.notHeld')}
            {lastHeld ? ` · ${t('history.lastHeld', { date: f.date(lastHeld.date) })}` : ''}
          </Txt>
        )}
      </Card>

      <Card>
        <Chips options={metricOptions} value={activeMetric} onChange={setMetric} />
        {chart.points.length >= 2 ? (
          <LineChart points={chart.points} currency={base} format={chart.format} />
        ) : (
          <Txt variant="muted">{t('history.needMore')}</Txt>
        )}
      </Card>

      <SectionTitle>{t('history.days')}</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {days.slice(0, limit).map((p, i) => (
          <DayRow
            key={p.date}
            point={p}
            kind={info.kind}
            symbol={info.symbol}
            base={base}
            first={i === 0}
            expanded={expanded === p.date}
            onToggle={() => setExpanded(expanded === p.date ? null : p.date)}
          />
        ))}
      </Card>
      {days.length > limit && (
        <Button title={t('history.showMore')} variant="ghost" onPress={() => setLimit(limit + PAGE)} />
      )}
      <Txt variant="small">{t('history.note')}</Txt>
    </Screen>
  );
}

/** "20 × $220.00", or just the balance for cash and debts. */
function QuantityLine({ point, kind }: { point: AssetHistoryPoint; kind: AssetKind }) {
  const f = useFormat();
  if (isCashLike(kind)) return <>{f.money(point.quantity, point.currency)}</>;
  return (
    <>
      {f.number(point.quantity)} × {f.money(point.unitPrice, point.currency)}
    </>
  );
}

function DayRow({
  point,
  kind,
  symbol,
  base,
  first,
  expanded,
  onToggle,
}: {
  point: AssetHistoryPoint;
  kind: AssetKind;
  symbol?: string;
  base: string;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const hf = useHistoryFormat();
  const c = useColors();
  const held = point.quantity !== 0;

  const notes: string[] = [];
  if (point.quantityChange !== undefined && Math.abs(point.quantityChange) > 1e-9)
    notes.push(hf.quantity(point.quantityChange, { kind, currency: point.currency, symbol }));
  if (point.priceChange !== undefined && Math.abs(point.priceChange) >= 0.0005) {
    const pct = `${point.priceChange > 0 ? '+' : ''}${f.percent(point.priceChange)}`;
    notes.push(t('history.priceChange', { change: pct }));
  }

  return (
    <View style={[!first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        disabled={!held}
        onPress={onToggle}
        style={({ pressed }) => [styles.day, pressed && { opacity: 0.6 }]}>
        <View style={styles.dayMain}>
          <Txt style={styles.dayTitle}>{f.date(point.date)}</Txt>
          <Txt variant="muted" tabular numberOfLines={1} style={styles.daySub}>
            {held ? <QuantityLine point={point} kind={kind} /> : t('history.notHeld')}
          </Txt>
          {notes.length > 0 && (
            <Txt variant="small" tabular numberOfLines={1}>
              {notes.join(' · ')}
            </Txt>
          )}
        </View>
        <View style={styles.dayRight}>
          <Txt tabular style={styles.dayTitle}>
            {f.money(point.value, base)}
          </Txt>
          {isChange(point.valueChange) && (
            <Txt
              variant="muted"
              tabular
              style={[styles.daySub, { color: point.valueChange >= 0 ? c.good : c.critical }]}>
              {hf.change(point.valueChange, base)}
            </Txt>
          )}
        </View>
        {held && <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />}
      </Pressable>
      {expanded && (
        <View style={styles.accounts}>
          {point.accounts.map((a) => (
            <View key={a.institutionId} style={styles.accountRow}>
              <Txt variant="secondary" numberOfLines={1} style={{ flex: 1 }}>
                {a.institutionName}
              </Txt>
              <Txt variant="muted" tabular>
                {isCashLike(kind) ? f.money(a.quantity, point.currency) : f.number(a.quantity)}
              </Txt>
              <Txt variant="secondary" tabular style={styles.accountValue}>
                {f.money(a.value, base)}
              </Txt>
            </View>
          ))}
          {point.incomplete && <Txt variant="small">{t('common.missingValue')}</Txt>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindBar: { width: 4, height: 16, borderRadius: 2 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 48 },
  dayMain: { flex: 1, gap: 2 },
  dayRight: { alignItems: 'flex-end', gap: 2, maxWidth: '50%' },
  dayTitle: { fontSize: 16, fontWeight: '500' },
  daySub: { fontSize: 13 },
  accounts: { gap: 6, paddingBottom: 10, paddingLeft: 12 },
  accountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  accountValue: { minWidth: 90, textAlign: 'right' },
});
