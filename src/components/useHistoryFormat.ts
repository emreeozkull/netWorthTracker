import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { AssetKind } from '@/domain/types';
import { useFormat } from '@/i18n/format';

const SHARE_KINDS: AssetKind[] = ['stock', 'etf', 'fund'];

/** Formatting for history changes: signed money deltas and quantity changes like "+5 shares". */
export function useHistoryFormat() {
  const { t } = useTranslation();
  const f = useFormat();

  return useMemo(() => {
    /** "▲ $1,234.00 (2.5%)" — the percentage is shown when a non-zero reference value is given. */
    const change = (delta: number, currency: string, reference?: number) => {
      const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '•';
      const pct = reference ? ` (${f.percent(delta / Math.abs(reference))})` : '';
      return `${arrow} ${f.money(Math.abs(delta), currency)}${pct}`;
    };

    const quantity = (
      delta: number,
      position: { kind: AssetKind; currency: string; symbol?: string },
    ) => {
      const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
      const abs = Math.abs(delta);
      if (position.kind === 'cash' || position.kind === 'debt') return `${sign}${f.money(abs, position.currency)}`;
      const qty = `${sign}${f.number(abs)}`;
      if (SHARE_KINDS.includes(position.kind)) return t('history.shares', { count: abs, qty });
      if (position.symbol) return `${qty} ${position.symbol}`;
      return t('history.units', { qty });
    };

    return { change, quantity };
  }, [f, t]);
}
