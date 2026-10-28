import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  const run =
    kind === 'light'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(
          kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        );
  run.catch(() => undefined);
}

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom', 'left', 'right'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.scrollContent, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLarge,
        buttonVariants[variant],
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.text : colors.primary} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text
            style={[
              styles.buttonLabel,
              size === 'lg' && styles.buttonLabelLarge,
              variant === 'ghost' && { color: colors.primarySoft },
              variant === 'danger' && { color: colors.danger },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'rgba(248, 113, 113, 0.12)', borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.4)' },
};

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={[typography.label, styles.sectionTitle]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function ProgressBar({
  progress,
  color = colors.primary,
  accessibilityLabel,
}: {
  progress: number;
  color?: string;
  accessibilityLabel?: string;
}) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 600 });
  }, [progress, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
    </View>
  );
}

/** Option sélectionnable (radio) avec titre et description. */
export function Choice({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.fill}>
        <Text style={typography.bodyStrong}>{title}</Text>
        {description ? <Text style={typography.caption}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function StatTile({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={styles.statTile} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[typography.bodyStrong, styles.center]}>{title}</Text>
      <Text style={[typography.caption, styles.center]}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  button: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: { minHeight: 64 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonLabel: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  buttonLabelLarge: { fontSize: 19, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: { marginTop: spacing.sm },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 16,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  statTile: {
    flex: 1,
    minWidth: 130,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  empty: { padding: spacing.xl, gap: spacing.sm, alignItems: 'center' },
});
