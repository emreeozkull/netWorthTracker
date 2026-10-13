import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button, Card, Field, Screen, SectionTitle, Txt } from '@/components/ui';
import { createBackup, MIN_BACKUP_PASSWORD, readBackup } from '@/storage/backup';
import { pickBackupFile, shareBackupFile } from '@/storage/backup-io';
import { DecryptionError } from '@/storage/crypto';
import { useAppStore } from '@/store/useAppStore';

export default function BackupScreen() {
  const { t } = useTranslation();
  const replaceData = useAppStore((s) => s.replaceData);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [error, setError] = useState<string>();

  const exportError =
    password.length > 0 && password.length < MIN_BACKUP_PASSWORD
      ? t('backup.tooShort', { count: MIN_BACKUP_PASSWORD })
      : confirm.length > 0 && confirm !== password
        ? t('backup.mismatch')
        : undefined;

  const doExport = async () => {
    setBusy('export');
    try {
      const contents = await createBackup(useAppStore.getState().data, password);
      await shareBackupFile(contents);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setError(undefined);
    const text = await pickBackupFile();
    if (text === null) return;
    setBusy('import');
    try {
      const data = await readBackup(text, importPassword);
      Alert.alert(t('backup.importConfirmTitle'), t('backup.importConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          style: 'destructive',
          onPress: () => {
            replaceData(data);
            Alert.alert(t('backup.restored'));
            router.back();
          },
        },
      ]);
    } catch (e) {
      setError(e instanceof DecryptionError ? t('backup.wrongPassword') : t('backup.invalidFile'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Txt variant="secondary">{t('backup.intro')}</Txt>

      <SectionTitle>{t('backup.exportTitle')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Field
          label={t('backup.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <Field
          label={t('backup.confirmPassword')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          error={exportError}
        />
        <Button
          title={busy === 'export' ? t('backup.working') : t('backup.export')}
          icon="share-outline"
          onPress={doExport}
          loading={busy === 'export'}
          disabled={password.length < MIN_BACKUP_PASSWORD || password !== confirm}
        />
      </Card>

      <SectionTitle>{t('backup.importTitle')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Field
          label={t('backup.password')}
          value={importPassword}
          onChangeText={setImportPassword}
          secureTextEntry
          autoCapitalize="none"
          error={error}
        />
        <Button
          title={busy === 'import' ? t('backup.working') : t('backup.import')}
          icon="folder-open-outline"
          variant="secondary"
          onPress={doImport}
          loading={busy === 'import'}
          disabled={importPassword.length === 0}
        />
      </Card>
    </Screen>
  );
}
