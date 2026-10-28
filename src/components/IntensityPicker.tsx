import { Pressable, StyleSheet, Text, View } from 'react-native';

import { INTENSITY_MAX, INTENSITY_MIN } from '@/domain/sos';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

import { haptic } from './ui';

/** Couleur graduelle : du bleu calme à l'orange vif. */
function intensityColor(value: number): string {
  const palette = ['#38BDF8', '#5EB8E8', '#7DB3D6', '#A3ADB8', '#C9A58F', '#E59B6A', '#F59048', '#F97316', '#EA580C', '#DC2626'];
  return palette[value - 1] ?? colors.primary;
}

export function IntensityPicker({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const values = Array.from({ length: INTENSITY_MAX - INTENSITY_MIN + 1 }, (_, index) => INTENSITY_MIN + index);
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Intensité de l'envie, de 1 à 10">
        {values.map((item) => {
          const selected = item === value;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${item} sur 10`}
              onPress={() => {
                haptic('light');
                onChange(item);
              }}
              style={({ pressed }) => [
                styles.cell,
                { borderColor: intensityColor(item) },
                selected && { backgroundColor: intensityColor(item) },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.value, selected && { color: colors.background }]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scale}>
        <Text style={typography.caption}>Légère</Text>
        <Text style={typography.caption}>Très forte</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  cell: {
    width: MIN_TOUCH + 8,
    height: MIN_TOUCH + 8,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  value: { fontSize: 20, fontWeight: '800', color: colors.text },
  scale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
});
