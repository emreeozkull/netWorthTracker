import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Card, ListRow, Screen, Txt } from '@/components/ui';
import { usePriceRefresh } from '@/components/usePriceRefresh';
import { summarizeInstitutions } from '@/domain/aggregate';
import { useFormat } from '@/i18n/format';
import { useData } from '@/store/useAppStore';
import { useSeriesColors } from '@/theme';

export default function InstitutionsScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const series = useSeriesColors();
  const data = useData();
  const { refreshControl } = usePriceRefresh();
  const base = data.settings.baseCurrency;
  const rows = summarizeInstitutions(data, base);

  if (rows.length === 0) {
    return (
      <Screen>
        <Txt variant="muted">{t('institutions.empty')}</Txt>
        <Button title={t('forms.newInstitution')} icon="add" onPress={() => router.push('/institution/edit')} />
      </Screen>
    );
  }

  return (
    <Screen refreshControl={refreshControl}>
      <Card style={{ paddingVertical: 4 }}>
        {rows.map((r, i) => (
          <ListRow
            key={r.institution.id}
            first={i === 0}
            color={series.swatch(r.institution.color)}
            title={r.institution.name}
            subtitle={`${t(`institutionTypes.${r.institution.type}`)} · ${t('institutions.holdings', { count: r.holdingCount })}`}
            right={f.money(r.total, base)}
            rightSub={r.incomplete ? t('common.missingValue') : undefined}
            chevron
            onPress={() => router.push({ pathname: '/institution/[id]', params: { id: r.institution.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
