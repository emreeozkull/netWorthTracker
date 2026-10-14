import { useEffect } from 'react';
import { AppState } from 'react-native';

import { isDailyFetchDue, unpricedAutoAssets } from '@/prices/daily';
import { useAppStore } from '@/store/useAppStore';

/** Minimum gap after a failed automatic refresh, so an offline device isn't retried on every foreground. */
const RETRY_AFTER_MS = 10 * 60 * 1000;
let retryBlockedUntil = 0;
/** Asset id + symbol pairs already tried this session, so a bad ticker isn't fetched again and again. */
const attemptedAssets = new Set<string>();

function canFetch() {
  const { status, locked, data } = useAppStore.getState();
  return status === 'ready' && !locked && data.settings.fetchEnabled && AppState.currentState !== 'background';
}

function refreshIfDue() {
  if (!canFetch()) return;
  const { data, refreshPrices } = useAppStore.getState();
  const now = Date.now();
  if (!isDailyFetchDue(data.market.pricesFetchedAt, now) || now < retryBlockedUntil) return;
  const before = data.market.pricesFetchedAt;
  // Silent: no spinner, and errors are left for the next manual refresh to report.
  refreshPrices({ silent: true })
    .then(() => {
      if (useAppStore.getState().data.market.pricesFetchedAt === before) retryBlockedUntil = Date.now() + RETRY_AFTER_MS;
    })
    .catch(() => {
      retryBlockedUntil = Date.now() + RETRY_AFTER_MS;
    });
}

/** Fetches assets that have never been priced (e.g. after loading demo data or restoring a backup). */
function priceNewAssets() {
  if (!canFetch()) return;
  const { data, refreshAsset } = useAppStore.getState();
  for (const asset of unpricedAutoAssets(data.assets)) {
    const key = `${asset.id}|${asset.symbol}`;
    if (attemptedAssets.has(key)) continue;
    attemptedAssets.add(key);
    refreshAsset(asset.id).catch(() => {});
  }
}

/**
 * Refreshes prices once per local day: when the data is ready and unlocked on launch,
 * when online prices get switched on, and whenever the app returns to the foreground.
 * Assets that have no fetched price yet are priced as soon as they appear, even if
 * today's refresh has already run.
 */
export function useDailyPriceRefresh() {
  const status = useAppStore((s) => s.status);
  const locked = useAppStore((s) => s.locked);
  const fetchEnabled = useAppStore((s) => s.data.settings.fetchEnabled);
  const pricesFetchedAt = useAppStore((s) => s.data.market.pricesFetchedAt);
  const unpricedKey = useAppStore((s) =>
    unpricedAutoAssets(s.data.assets)
      .map((a) => `${a.id}|${a.symbol}`)
      .join(','),
  );

  useEffect(() => {
    if (status !== 'ready' || locked || !fetchEnabled) return;
    refreshIfDue();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshIfDue();
        priceNewAssets();
      }
    });
    return () => sub.remove();
  }, [status, locked, fetchEnabled, pricesFetchedAt]);

  useEffect(() => {
    if (status !== 'ready' || locked || !fetchEnabled || !unpricedKey) return;
    priceNewAssets();
  }, [status, locked, fetchEnabled, unpricedKey]);
}
