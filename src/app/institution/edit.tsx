import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button, Field, LabeledChips, Screen } from '@/components/ui';
import { INSTITUTION_TYPES, type InstitutionType } from '@/domain/types';
import { useAppStore, useData } from '@/store/useAppStore';
import { INSTITUTION_SWATCHES, useSeriesColors } from '@/theme';

export default function EditInstitution() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const series = useSeriesColors();
  const data = useData();
  const upsert = useAppStore((s) => s.upsertInstitution);
  const remove = useAppStore((s) => s.deleteInstitution);
  const existing = data.institutions.find((i) => i.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<InstitutionType>(existing?.type ?? 'bank');
  const [color, setColor] = useState(
    existing?.color ?? INSTITUTION_SWATCHES[data.institutions.length % INSTITUTION_SWATCHES.length],
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string>();

  const save = () => {
    if (!name.trim()) return setError(t('forms.nameRequired'));
    upsert({ id: existing?.id, name: name.trim(), type, color, note: note.trim() || undefined });
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    const count = data.holdings.filter((h) => h.institutionId === existing.id).length;
    Alert.alert(t('forms.deleteInstitutionTitle'), t('forms.deleteInstitutionMsg', { count }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove(existing.id);
          router.dismissAll();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('forms.editInstitution') : t('forms.newInstitution') }} />
      <Field
        label={t('common.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        autoFocus={!existing}
        error={error}
      />
      <LabeledChips
        label={t('forms.type')}
        options={INSTITUTION_TYPES.map((v) => ({ value: v, label: t(`institutionTypes.${v}`) }))}
        value={type}
        onChange={setType}
      />
      <LabeledChips
        label={t('forms.color')}
        options={INSTITUTION_SWATCHES.map((v, i) => ({ value: v, label: String(i + 1), color: series.swatch(v) }))}
        value={color}
        onChange={setColor}
      />
      <Field label={`${t('common.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} multiline />
      <Button title={t('common.save')} onPress={save} />
      {existing && <Button title={t('common.delete')} variant="danger" onPress={confirmDelete} />}
    </Screen>
  );
}
