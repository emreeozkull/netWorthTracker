import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LineChart } from '@/components/charts';
import { Button, Card, Chips, ListRow, Screen, SectionTitle, Txt } from '@/components/ui';
import { useHistoryFormat } from '@/components/useHistoryFormat';
import { accountSeries, historyAssets, historyInstitutions, withChanges } from '@/domain/history';
import { useFormat } from '@/i18n/format';
import { useData } from '@/store/useAppStore';
import { OTHER_COLOR, useSeriesColors } from '@/theme';

const PAGE = 60;
const ALL = '__all';

type Mode = 'account' | 'asset';

/** Daily snapshots, browsed by account (value over time + list of days) or by asset. */
export default function History() {
  const { t } = useTranslation();
  const f = useFormat();
  const hf = useHistoryFormat();
  const series = useSeriesColors();
  const data = useData();
  const base = data.settings.baseCurrency;
  const [mode, setMode] = useState<Mode>('account');
  const [account, setAccount] = useState<string>(ALL);
  const [limit, setLimit] = useState(PAGE);

  const accounts = useMemo(
    () => historyInstitutions(data.snapshots, data.institutions),
    [data.snapshots, data.institutions],
  );

  const options = useMemo(() => {
    const colors = new Map(data.institutions.map((i) => [i.id, i.color]));
    return [
      { value: ALL, label: t('history.allAccounts') },
      ...accounts.map((a) => ({
        value: a.id,
        label: a.name,
        color: series.swatch(colors.get(a.id) ?? OTHER_COLOR),
      })),
    ];
  }, [accounts, data.institutions, series, t]);

  const modeOptions = useMemo(
    () => [
      { value: 'account' as const, label: t('history.byAccount') },
      { value: 'asset' as const, label: t('history.byAsset') },
    ],
    [t],
  );

  const selected = account !== ALL && accounts.some((a) => a.id === account) ? account : undefined;

  const points = useMemo(
    () => accountSeries(data.snapshots, base, selected),
    [data.snapshots, base, selected],
  );
  const rows = useMemo(() => withChanges(points).reverse(), [points]);

  const assets = useMemo(
    () => (mode === 'asset' ? historyAssets(data.snapshots, base, data.assets) : []),
    [mode, data.snapshots, base, data.assets],
  );

  if (data.snapshots.length === 0) {
    return (
      <Screen>
        <Card>
          <Txt variant="secondary">{t('history.empty')}</Txt>
        </Card>
      </Screen>
    );
  }

  const selectAccount = (value: string) => {
    setAccount(value);
    setLimit(PAGE);
  };

  return (
    <Screen>
      <Chips options={modeOptions} value={mode} onChange={setMode} />

      {mode === 'asset' ? (
        <Card style={{ paddingVertical: 4 }}>
          {assets.length === 0 && <Txt variant="muted" style={{ paddingVertical: 12 }}>{t('history.assetsEmpty')}</Txt>}
          {assets.map((a, i) => {
            const amount =
              a.kind === 'cash' || a.kind === 'debt' ? f.money(a.quantity, a.currency) : f.number(a.quantity);
            return (
              <ListRow
                key={a.identity}
                first={i === 0}
                color={series.kind(a.kind)}
                title={a.name}
                subtitle={
                  a.closed
                    ? t('history.lastHeld', { date: f.date(a.lastDate) })
                    : a.symbol
                      ? `${a.symbol} · ${amount}`
                      : amount
                }
                right={a.closed ? t('history.removed') : f.money(a.value, base)}
                rightSub={t(`kinds.${a.kind}`)}
                chevron
                onPress={() => router.push({ pathname: '/history/asset/[assetId]', params: { assetId: a.id } })}
              />
            );
          })}
        </Card>
      ) : (
        <>
          <Card>
            <Txt variant="secondary">{selected ? t('history.accountValue') : t('history.netWorth')}</Txt>
            {options.length > 2 || selected ? (
              <Chips scroll options={options} value={selected ?? ALL} onChange={selectAccount} />
            ) : null}
            {points.length >= 2 ? (
              <LineChart points={points} currency={base} />
            ) : (
              <Txt variant="muted">{t('history.needMore')}</Txt>
            )}
          </Card>

          {rows.length > 0 && <SectionTitle>{t('history.days')}</SectionTitle>}
          {rows.length > 0 && (
            <Card style={{ paddingVertical: 4 }}>
              {rows.slice(0, limit).map((row, i) => (
                <ListRow
                  key={row.date}
                  first={i === 0}
                  title={f.date(row.date)}
                  subtitle={
                    row.change === undefined
                      ? t('history.firstSnapshot')
                      : hf.change(row.change, base, row.previousValue)
                  }
                  right={f.money(row.value, base)}
                  chevron
                  onPress={() => router.push({ pathname: '/history/[date]', params: { date: row.date } })}
                />
              ))}
            </Card>
          )}
          {rows.length > limit && (
            <Button title={t('history.showMore')} variant="ghost" onPress={() => setLimit(limit + PAGE)} />
          )}
        </>
      )}
      <Txt variant="small">{t('history.note')}</Txt>
    </Screen>
  );
}
