/** True when prices have never been fetched or were last fetched on an earlier local calendar day. */
export function isDailyFetchDue(lastFetchedAt: number | undefined, now: number = Date.now()): boolean {
  if (lastFetchedAt === undefined) return true;
  const last = new Date(lastFetchedAt);
  const today = new Date(now);
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth() !== today.getMonth() ||
    last.getDate() !== today.getDate()
  );
}

/** Auto-priced assets with a symbol that have never received a fetched price. */
export function unpricedAutoAssets<T extends { priceMode: string; symbol?: string; lastPrice?: number }>(
  assets: T[],
): T[] {
  return assets.filter((a) => a.priceMode === 'auto' && !!a.symbol?.trim() && a.lastPrice === undefined);
}
