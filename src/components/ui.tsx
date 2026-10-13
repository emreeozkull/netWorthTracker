import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@/theme';

export function Screen({
  children,
  refreshControl,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const c = useColors();
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  );
}

type TxtVariant = 'hero' | 'title' | 'heading' | 'body' | 'secondary' | 'muted' | 'small';

export function Txt({
  variant = 'body',
  style,
  children,
  numberOfLines,
  tabular,
}: {
  variant?: TxtVariant;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  tabular?: boolean;
}) {
  const c = useColors();
  const color =
    variant === 'secondary' ? c.textSecondary : variant === 'muted' || variant === 'small' ? c.muted : c.text;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color },
        textStyles[variant],
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt variant="secondary" style={styles.sectionTitleText}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
}) {
  const c = useColors();
  const bg =
    variant === 'primary' ? c.primary : variant === 'secondary' ? c.chip : 'transparent';
  const fg =
    variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.critical : variant === 'ghost' ? c.primary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: c.critical },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
}) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={12} style={styles.iconButton}>
      <Ionicons name={icon} size={24} color={c.primary} />
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Txt variant="secondary" style={styles.label}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={c.muted}
        {...input}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.card, borderColor: error ? c.critical : c.border },
          input.style,
        ]}
      />
      {error ? (
        <Txt variant="small" style={{ color: c.critical }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small">{hint}</Txt>
      ) : null}
    </View>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

/** Wrapping row of selectable chips. Single-select unless `multi`. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: ChipOption<T>[];
  value: T | T[] | undefined;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const c = useColors();
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const chips = options.map((o) => {
    const on = selected(o.value);
    return (
      <Pressable
        key={o.value}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onChange(o.value)}
        style={[
          styles.chip,
          { backgroundColor: on ? c.primary : c.chip, borderColor: on ? c.primary : c.border },
        ]}>
        {o.color && <View style={[styles.dot, { backgroundColor: o.color }]} />}
        <Text style={{ color: on ? c.onPrimary : c.text, fontSize: 14, fontWeight: '500' }}>{o.label}</Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={styles.chipsWrap}>{chips}</View>;
}

export function LabeledChips<T extends string>(props: Parameters<typeof Chips<T>>[0] & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Txt variant="secondary" style={styles.label}>
        {props.label}
      </Txt>
      <Chips {...props} />
      {props.hint && <Txt variant="small">{props.hint}</Txt>}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  rightSub,
  color,
  onPress,
  onLongPress,
  chevron,
  first,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
  color?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  first?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
        pressed && { opacity: 0.6 },
      ]}>
      {color && <View style={[styles.rowDot, { backgroundColor: color }]} />}
      <View style={styles.rowMain}>
        <Txt numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="muted" numberOfLines={1} style={styles.rowSub}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {right !== undefined && (
          <Txt tabular style={styles.rowTitle}>
            {right}
          </Txt>
        )}
        {rightSub ? (
          <Txt variant="muted" tabular style={styles.rowSub}>
            {rightSub}
          </Txt>
        ) : null}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={16} color={c.muted} />}
    </Pressable>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt>{label}</Txt>
        {hint && <Txt variant="small">{hint}</Txt>}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: c.primary }} />
    </View>
  );
}

export function Banner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: c.warningBg }]}>
      <Ionicons name="alert-circle" size={18} color={c.warningText} />
      <Text style={{ color: c.warningText, flex: 1, fontSize: 14 }}>{children}</Text>
      {action}
    </View>
  );
}

const textStyles = StyleSheet.create({
  hero: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16 },
  secondary: { fontSize: 15 },
  muted: { fontSize: 14 },
  small: { fontSize: 12 },
});

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 48 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  sectionTitleText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  button: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { paddingHorizontal: 4 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 48 },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  rowMain: { flex: 1, gap: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2, maxWidth: '55%' },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowSub: { fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
});
