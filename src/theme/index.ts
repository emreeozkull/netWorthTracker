import { useColorScheme } from 'react-native';

import type { AssetKind } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';

const light = {
  background: '#f4f4f1',
  card: '#fcfcfb',
  text: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  border: '#e1e0d9',
  grid: '#e1e0d9',
  primary: '#2a78d6',
  onPrimary: '#ffffff',
  chip: '#ebebe7',
  good: '#006300',
  critical: '#d03b3b',
  warningBg: '#fdf3dc',
  warningText: '#6b4a00',
};

const dark: typeof light = {
  background: '#0d0d0d',
  card: '#1a1a19',
  text: '#f0efec',
  textSecondary: '#c3c2b7',
  muted: '#898781',
  border: '#2c2c2a',
  grid: '#2c2c2a',
  primary: '#3987e5',
  onPrimary: '#ffffff',
  chip: '#262624',
  good: '#0ca30c',
  critical: '#e66767',
  warningBg: '#3a2e10',
  warningText: '#f5d27a',
};

export type Colors = typeof light;

/** Categorical slots, in fixed order. Light and dark steps of the same hues. */
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const OTHER_COLOR = '#898781';

/** Swatches offered for institutions; stored as the light step and mapped per theme. */
export const INSTITUTION_SWATCHES = SERIES_LIGHT;

/** Each asset kind keeps the same color everywhere, regardless of rank. */
const KIND_SLOT: Record<AssetKind, number | null> = {
  cash: 0,
  stock: 1,
  etf: 2,
  gold: 3,
  fund: 4,
  bond: 5,
  crypto: 6,
  realEstate: 7,
  debt: null,
  other: null,
};

export function useIsDark(): boolean {
  const pref = useAppStore((s) => s.data.settings.theme);
  const system = useColorScheme();
  return pref === 'system' ? system === 'dark' : pref === 'dark';
}

export function useColors(): Colors {
  return useIsDark() ? dark : light;
}

export function useSeriesColors() {
  const isDark = useIsDark();
  const series = isDark ? SERIES_DARK : SERIES_LIGHT;
  return {
    kind: (kind: AssetKind) => {
      const slot = KIND_SLOT[kind];
      return slot === null ? OTHER_COLOR : series[slot];
    },
    /** Maps a stored swatch to its step for the current theme; custom colors pass through. */
    swatch: (color: string) => {
      const i = SERIES_LIGHT.indexOf(color);
      return i >= 0 ? series[i] : color;
    },
  };
}
