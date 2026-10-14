import { useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useFormat } from '@/i18n/format';
import { OTHER_COLOR, useColors } from '@/theme';

import { Txt } from './ui';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

const MAX_SLICES = 7;

/** Keeps the largest slices and folds the rest into "Other" so hues never cycle. */
export function foldSlices(slices: DonutSlice[], otherLabel: string): DonutSlice[] {
  if (slices.length <= MAX_SLICES + 1) return slices;
  const head = slices.slice(0, MAX_SLICES);
  const rest = slices.slice(MAX_SLICES).reduce((s, x) => s + x.value, 0);
  return [...head, { key: '__other', label: otherLabel, value: rest, color: OTHER_COLOR }];
}

/** Donut with a legend that doubles as the data table (label, value, share). */
export function Donut({ slices, currency }: { slices: DonutSlice[]; currency: string }) {
  const c = useColors();
  const f = useFormat();
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;

  const size = 150;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0;
  const starts = slices.map((_, i) =>
    slices.slice(0, i).reduce((sum, x) => sum + (x.value / total) * circ, 0),
  );
  const focus = slices.find((s) => s.key === active);

  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.grid} strokeWidth={stroke} fill="none" />
          {slices.map((s, i) => {
            const len = (s.value / total) * circ;
            const dash = Math.max(len - gap, 0.5);
            return (
              <Circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeWidth={active && active !== s.key ? stroke - 6 : stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-starts[i]}
                fill="none"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                onPress={() => setActive(active === s.key ? null : s.key)}
              />
            );
          })}
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Txt variant="small" numberOfLines={1}>
            {focus ? focus.label : ''}
          </Txt>
          <Txt variant="heading" tabular>
            {f.percent((focus?.value ?? total) / total)}
          </Txt>
        </View>
      </View>
      <View style={styles.legend}>
        {slices.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setActive(active === s.key ? null : s.key)}
            style={[styles.legendRow, active && active !== s.key && { opacity: 0.45 }]}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Txt variant="muted" numberOfLines={1} style={{ flex: 1, color: c.text }}>
              {s.label}
            </Txt>
            <Txt variant="muted" tabular>
              {f.percent(s.value / total)}
            </Txt>
          </Pressable>
        ))}
        {focus && (
          <Txt variant="small" tabular>
            {f.money(focus.value, currency)}
          </Txt>
        )}
      </View>
    </View>
  );
}

export interface LinePoint {
  date: string;
  value: number;
}

/** Formats a chart value; `compact` is used for the axis range. Defaults to money in `currency`. */
export type ValueFormatter = (value: number, compact: boolean) => string;

/** Single-series line with a touch crosshair and tooltip. */
export function LineChart({
  points,
  currency,
  format,
}: {
  points: LinePoint[];
  currency: string;
  format?: ValueFormatter;
}) {
  const c = useColors();
  const f = useFormat();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const height = 140;
  const padY = 8;
  const fmt: ValueFormatter = format ?? ((v, compact) => f.money(v, currency, { compact }));

  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => padY + (1 - (v - min) / (max - min)) * (height - padY * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  const track = (e: GestureResponderEvent) => {
    if (!width) return;
    const i = Math.round((e.nativeEvent.locationX / width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const shown = hover !== null ? points[hover] : points[points.length - 1];

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.lineHeader}>
        <Txt variant="heading" tabular>
          {fmt(shown.value, false)}
        </Txt>
        <Txt variant="muted">{f.date(shown.date)}</Txt>
      </View>
      <View
        style={{ height }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={track}
        onResponderMove={track}
        onResponderRelease={() => setHover(null)}
        onResponderTerminate={() => setHover(null)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={height - padY} y2={height - padY} stroke={c.grid} strokeWidth={1} />
            <Path d={d} stroke={c.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && (
              <>
                <Line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke={c.muted} strokeWidth={1} />
                <Circle cx={x(hover)} cy={y(points[hover].value)} r={5} fill={c.primary} stroke={c.card} strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
      </View>
      <View style={styles.lineAxis}>
        <Txt variant="small">{f.date(points[0].date)}</Txt>
        <Txt variant="small" tabular>
          {fmt(min, true)} – {fmt(max, true)}
        </Txt>
        <Txt variant="small">{f.date(points[points.length - 1].date)}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 30 },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  lineAxis: { flexDirection: 'row', justifyContent: 'space-between' },
});
