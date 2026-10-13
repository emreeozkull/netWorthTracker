import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { LockOverlay } from '@/components/LockOverlay';
import { Button, Card, Screen, Txt } from '@/components/ui';
import i18n, { resolveLanguage } from '@/i18n';
import { useAppLockWatcher } from '@/storage/lock';
import { useAppStore } from '@/store/useAppStore';
import { useColors, useIsDark } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAppStore((s) => s.status);
  const locked = useAppStore((s) => s.locked);
  const language = useAppStore((s) => s.data.settings.language);
  const isDark = useIsDark();
  const c = useColors();
  const { t } = useTranslation();

  useAppLockWatcher();

  useEffect(() => {
    void useAppStore.getState().init();
  }, []);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  useEffect(() => {
    void i18n.changeLanguage(resolveLanguage(language));
  }, [language]);

  if (status === 'loading') return null;

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.background, card: c.card, text: c.text, border: c.border, primary: c.primary },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {status === 'error' ? (
        <LoadError />
      ) : (
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="institution/[id]" options={{ title: '' }} />
          <Stack.Screen name="institution/edit" options={{ presentation: 'modal', title: t('forms.newInstitution') }} />
          <Stack.Screen name="asset/edit" options={{ presentation: 'modal', title: t('forms.editAsset') }} />
          <Stack.Screen name="holding/edit" options={{ presentation: 'modal', title: t('forms.newHolding') }} />
          <Stack.Screen name="rates" options={{ title: t('settings.rates') }} />
          <Stack.Screen name="backup" options={{ title: t('settings.backup') }} />
        </Stack>
      )}
      {locked && status === 'ready' && <LockOverlay />}
    </ThemeProvider>
  );
}

function LoadError() {
  const { t } = useTranslation();
  const error = useAppStore((s) => s.error);
  const c = useColors();

  const reset = () =>
    Alert.alert(t('errors.reset'), t('settings.deleteAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('errors.reset'),
        style: 'destructive',
        onPress: async () => {
          await useAppStore.getState().wipe();
          useAppStore.setState({ status: 'ready' });
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 80 }}>
      <Screen>
        <Card>
          <Txt variant="title">{t('errors.loadTitle')}</Txt>
          <Txt variant="secondary">{t('errors.loadBody')}</Txt>
          {error && <Txt variant="small">{error}</Txt>}
        </Card>
        <Button title={t('errors.reset')} variant="danger" onPress={reset} />
      </Screen>
    </View>
  );
}
