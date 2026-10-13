import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AssetForm, draftFromAsset, draftToAsset } from '@/components/AssetForm';
import { Button, Screen, Txt } from '@/components/ui';
import { useAppStore, useData } from '@/store/useAppStore';
import { useColors } from '@/theme';

export default function EditAsset() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const c = useColors();
  const data = useData();
  const upsert = useAppStore((s) => s.upsertAsset);
  const remove = useAppStore((s) => s.deleteAsset);
  const existing = data.assets.find((a) => a.id === id);
  const [draft, setDraft] = useState(() => draftFromAsset(existing, data.settings.baseCurrency));
  const [error, setError] = useState<string>();

  const save = () => {
    const result = draftToAsset(draft, existing);
    if (!result.asset) return setError(result.error);
    upsert({ ...result.asset, id: existing?.id });
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    const count = data.holdings.filter((h) => h.assetId === existing.id).length;
    Alert.alert(t('forms.deleteAssetTitle'), t('forms.deleteAssetMsg', { count }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('forms.editAsset') : t('forms.newAsset') }} />
      <AssetForm draft={draft} onChange={setDraft} previous={existing} />
      {error && <Txt style={{ color: c.critical }}>{t(error)}</Txt>}
      <Button title={t('common.save')} onPress={save} />
      {existing && <Button title={t('common.delete')} variant="danger" onPress={confirmDelete} />}
    </Screen>
  );
}
