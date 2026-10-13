import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { useColors } from '@/theme';

/** Pull-to-refresh that is only wired up when online price fetching is enabled. */
export function usePriceRefresh() {
  const c = useColors();
  const enabled = useAppStore((s) => s.data.settings.fetchEnabled);
  const refreshing = useAppStore((s) => s.refreshing);
  const refreshPrices = useAppStore((s) => s.refreshPrices);
  const [errors, setErrors] = useState<string[]>([]);

  const onRefresh = async () => setErrors(await refreshPrices());

  const refreshControl = enabled ? (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />
  ) : undefined;

  return { refreshControl, errors };
}
