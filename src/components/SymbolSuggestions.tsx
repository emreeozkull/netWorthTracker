import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { AssetKind } from '@/domain/types';
import { searchSymbols, type SymbolMatch } from '@/prices/search';
import { useColors } from '@/theme';

import { Txt } from './ui';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export interface SymbolSearchState {
  status: 'idle' | 'loading' | 'done' | 'error';
  results: SymbolMatch[];
}

const IDLE: SymbolSearchState = { status: 'idle', results: [] };

/**
 * Debounced symbol search. Each new query cancels the previous request and responses
 * that arrive out of order are dropped. Never call `search` unless online prices are on.
 */
export function useSymbolSearch(kind: AssetKind, preferIstanbul: boolean) {
  const [state, setState] = useState<SymbolSearchState>(IDLE);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    controller.current?.abort();
    controller.current = undefined;
    requestId.current += 1;
  }, []);

  const clear = useCallback(() => {
    cancel();
    setState(IDLE);
  }, [cancel]);

  const search = useCallback(
    (text: string) => {
      cancel();
      const query = text.trim();
      if (query.length < MIN_CHARS) return setState(IDLE);
      const id = requestId.current;
      // Keep showing the previous results while the next ones load, to avoid flicker.
      setState((s) => ({ ...s, status: 'loading' }));
      timer.current = setTimeout(async () => {
        const ctrl = new AbortController();
        controller.current = ctrl;
        try {
          const results = await searchSymbols(query, kind, { signal: ctrl.signal, preferIstanbul });
          if (id === requestId.current) setState({ status: 'done', results });
        } catch {
          if (id === requestId.current) setState({ status: 'error', results: [] });
        }
      }, DEBOUNCE_MS);
    },
    [cancel, kind, preferIstanbul],
  );

  useEffect(() => cancel, [cancel]);

  return { state, search, clear };
}

export function SymbolSuggestions({
  state,
  onPick,
}: {
  state: SymbolSearchState;
  onPick: (match: SymbolMatch) => void;
}) {
  const { t } = useTranslation();
  const c = useColors();
  if (state.status === 'idle') return null;

  const loading = state.status === 'loading';
  return (
    <View
      style={[styles.box, { borderColor: c.border, backgroundColor: c.card }]}
      accessibilityLabel={t('search.suggestions')}>
      {loading && state.results.length === 0 && (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={c.muted} accessibilityLabel={t('search.searching')} />
          <Txt variant="small">{t('search.searching')}</Txt>
        </View>
      )}
      {state.status === 'done' && state.results.length === 0 && (
        <Txt variant="small" style={styles.status}>
          {t('search.noMatches')}
        </Txt>
      )}
      {state.status === 'error' && (
        <Txt variant="small" style={styles.status}>
          {t('search.failed')}
        </Txt>
      )}
      {state.results.map((m, i) => (
        <Pressable
          key={m.symbol}
          accessibilityRole="button"
          accessibilityLabel={[m.symbol, m.name, m.exchange].filter(Boolean).join(', ')}
          accessibilityHint={t('search.pickHint')}
          onPress={() => onPick(m)}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
            pressed && { backgroundColor: c.chip },
          ]}>
          <View style={styles.rowMain}>
            <Txt numberOfLines={1} style={styles.symbol}>
              {m.symbol}
            </Txt>
            <Txt variant="muted" numberOfLines={1}>
              {m.name}
            </Txt>
          </View>
          <View style={styles.rowRight}>
            {m.exchange ? (
              <Txt variant="small" numberOfLines={1}>
                {m.exchange}
              </Txt>
            ) : null}
            <Txt variant="small" numberOfLines={1}>
              {t(`kinds.${m.kind}`)}
            </Txt>
          </View>
          {loading && i === 0 && <ActivityIndicator size="small" color={c.muted} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginTop: -8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  rowMain: { flex: 1, gap: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2, maxWidth: '40%' },
  symbol: { fontSize: 15, fontWeight: '600' },
});
