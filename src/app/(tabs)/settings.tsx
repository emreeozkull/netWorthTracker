import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button, Card, Field, LabeledChips, ListRow, Screen, SectionTitle, SwitchRow, Txt } from '@/components/ui';
import { CURRENCIES, type Settings } from '@/domain/types';
import { authenticate } from '@/storage/lock';
import { useAppStore, useSettings } from '@/store/useAppStore';

const LOCK_TIMEOUTS = [0, 30, 60, 300];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const update = useAppStore((s) => s.updateSettings);
  const refreshPrices = useAppStore((s) => s.refreshPrices);
  const refreshing = useAppStore((s) => s.refreshing);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const wipe = useAppStore((s) => s.wipe);
  const [finnhubKey, setFinnhubKey] = useState(settings.finnhubKey ?? '');

  const toggleLock = async (on: boolean) => {
    if (!on) return update({ lockEnabled: false });
    // Prove the device can authenticate before turning the lock on.
    const result = await authenticate(t('lock.prompt'));
    if (result === 'ok') update({ lockEnabled: true });
    else if (result === 'unavailable') Alert.alert(t('settings.appLock'), t('lock.noAuth'));
  };

  const refresh = async () => {
    const errors = await refreshPrices();
    Alert.alert(
      t('settings.prices'),
      errors.length ? `${t('dashboard.refreshErrors')}\n\n${errors.join('\n')}` : t('settings.refreshDone'),
    );
  };

  const confirm = (title: string, message: string, action: () => void) =>
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.ok'), style: 'destructive', onPress: action },
    ]);

  return (
    <Screen>
      <SectionTitle>{t('settings.general')}</SectionTitle>
      <Card style={{ gap: 14 }}>
        <LabeledChips
          label={t('settings.baseCurrency')}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          value={settings.baseCurrency}
          onChange={(baseCurrency) => update({ baseCurrency })}
        />
        <LabeledChips<Settings['language']>
          label={t('settings.language')}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'en', label: 'English' },
            { value: 'tr', label: 'Türkçe' },
          ]}
          value={settings.language}
          onChange={(language) => update({ language })}
        />
        <LabeledChips<Settings['theme']>
          label={t('settings.theme')}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'light', label: t('settings.light') },
            { value: 'dark', label: t('settings.dark') },
          ]}
          value={settings.theme}
          onChange={(theme) => update({ theme })}
        />
      </Card>

      <SectionTitle>{t('settings.security')}</SectionTitle>
      <Card style={{ gap: 14 }}>
        <SwitchRow
          label={t('settings.appLock')}
          hint={t('settings.appLockHint')}
          value={settings.lockEnabled}
          onValueChange={toggleLock}
        />
        {settings.lockEnabled && (
          <LabeledChips
            label={t('settings.lockAfter')}
            options={LOCK_TIMEOUTS.map((s) => ({
              value: String(s),
              label:
                s === 0
                  ? t('settings.immediately')
                  : s < 60
                    ? t('settings.seconds', { count: s })
                    : t('settings.minutes', { count: s / 60 }),
            }))}
            value={String(settings.lockTimeoutSec)}
            onChange={(v) => update({ lockTimeoutSec: Number(v) })}
          />
        )}
      </Card>

      <SectionTitle>{t('settings.prices')}</SectionTitle>
      <Card style={{ gap: 14 }}>
        <SwitchRow
          label={t('settings.fetchEnabled')}
          hint={t('settings.fetchPrivacy')}
          value={settings.fetchEnabled}
          onValueChange={(fetchEnabled) => update({ fetchEnabled })}
        />
        {settings.fetchEnabled && (
          <>
            <Field
              label={`${t('settings.finnhubKey')} (${t('common.optional')})`}
              hint={t('settings.finnhubHint')}
              value={finnhubKey}
              onChangeText={setFinnhubKey}
              onEndEditing={() => update({ finnhubKey: finnhubKey.trim() || undefined })}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Button title={t('settings.refreshNow')} icon="refresh" variant="secondary" onPress={refresh} loading={refreshing} />
          </>
        )}
        <ListRow first title={t('settings.rates')} chevron onPress={() => router.push('/rates')} />
      </Card>

      <SectionTitle>{t('settings.data')}</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow first title={t('settings.backup')} chevron onPress={() => router.push('/backup')} />
        <ListRow
          title={t('settings.loadDemo')}
          onPress={() => confirm(t('settings.loadDemo'), t('settings.loadDemoConfirm'), loadDemo)}
        />
      </Card>
      <Button
        title={t('settings.deleteAll')}
        variant="danger"
        onPress={() => confirm(t('settings.deleteAll'), t('settings.deleteAllConfirm'), () => void wipe())}
      />

      <SectionTitle>{t('settings.about')}</SectionTitle>
      <Card>
        <Txt variant="secondary">{t('settings.aboutText')}</Txt>
        <Txt variant="small">{t('settings.version', { version: Constants.expoConfig?.version ?? '' })}</Txt>
      </Card>
    </Screen>
  );
}
