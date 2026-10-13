import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { flushSave, useAppStore } from '@/store/useAppStore';

export type AuthResult = 'ok' | 'failed' | 'unavailable';

/** Biometrics with device-passcode fallback. */
export async function authenticate(promptMessage: string): Promise<AuthResult> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return 'unavailable';
  const result = await LocalAuthentication.authenticateAsync({ promptMessage });
  return result.success ? 'ok' : 'failed';
}

/** Saves on background and re-locks after the configured timeout. */
export function useAppLockWatcher() {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const { data, setLocked, locked } = useAppStore.getState();
      const { lockEnabled, lockTimeoutSec } = data.settings;
      if (state === 'background') {
        void flushSave();
        backgroundedAt.current = Date.now();
        if (lockEnabled && lockTimeoutSec === 0) setLocked(true);
      } else if (state === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (lockEnabled && !locked && since !== null && Date.now() - since >= lockTimeoutSec * 1000) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, []);
}
