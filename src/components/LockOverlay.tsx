import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { authenticate, type AuthResult } from '@/storage/lock';
import { useAppStore } from '@/store/useAppStore';
import { useColors } from '@/theme';

import { Button, Txt } from './ui';

/** Covers the whole app until the user authenticates. */
export function LockOverlay() {
  const { t } = useTranslation();
  const c = useColors();
  const setLocked = useAppStore((s) => s.setLocked);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleResult = useCallback(
    (result: AuthResult) => {
      if (result === 'ok') setLocked(false);
      // Without any device auth the lock can't be satisfied; don't trap the user out of their data.
      else if (result === 'unavailable') {
        setMessage(t('lock.noAuth'));
        setLocked(false);
      }
    },
    [setLocked, t],
  );

  const unlock = async () => {
    setBusy(true);
    try {
      handleResult(await authenticate(t('lock.prompt')));
    } finally {
      setBusy(false);
    }
  };

  // Prompt once as soon as the lock screen appears.
  useEffect(() => {
    let cancelled = false;
    void authenticate(t('lock.prompt')).then((result) => {
      if (!cancelled) handleResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [handleResult, t]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: c.background }]}>
      <Ionicons name="lock-closed" size={48} color={c.primary} />
      <Txt variant="title">{t('lock.title')}</Txt>
      {message && <Txt variant="muted">{message}</Txt>}
      <View style={{ alignSelf: 'stretch' }}>
        <Button title={t('lock.unlock')} icon="finger-print" onPress={unlock} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, zIndex: 100 },
});
