import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/domain/dates';
import { REMINDER_MAX_HOUR, REMINDER_MIN_HOUR } from '@/domain/rules';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

import { haptic } from './ui';

const HOURS = Array.from({ length: REMINDER_MAX_HOUR - REMINDER_MIN_HOUR + 1 }, (_, i) => REMINDER_MIN_HOUR + i);
const MINUTES = [0, 15, 30, 45];

function Chip({ label, selected, onPress, a11y }: { label: string; selected: boolean; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={a11y}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.chipLabel, selected && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Choix de l'heure du rappel, limité à 18 h – 23 h 45. */
export function TimePicker({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.title, { textAlign: 'center' }]} accessibilityLiveRegion="polite">
        {formatTime(hour, minute)}
      </Text>
      <Text style={typography.label}>Heure</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {HOURS.map((h) => (
          <Chip key={h} label={`${h} h`} a11y={`${h} heures`} selected={h === hour} onPress={() => onChange(h, minute)} />
        ))}
      </View>
      <Text style={typography.label}>Minutes</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {MINUTES.map((m) => (
          <Chip
            key={m}
            label={String(m).padStart(2, '0')}
            a11y={`${m} minutes`}
            selected={m === minute}
            onPress={() => onChange(hour, m)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: MIN_TOUCH + 12,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 },
});
