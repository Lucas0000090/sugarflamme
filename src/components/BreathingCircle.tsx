import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, typography } from '@/theme';

export const INHALE_MS = 4000;
export const EXHALE_MS = 6000;
const CYCLE_MS = INHALE_MS + EXHALE_MS;

export function breathingPhase(elapsedMs: number): { phase: 'inhale' | 'exhale'; remainingMs: number } {
  const inCycle = elapsedMs % CYCLE_MS;
  return inCycle < INHALE_MS
    ? { phase: 'inhale', remainingMs: INHALE_MS - inCycle }
    : { phase: 'exhale', remainingMs: CYCLE_MS - inCycle };
}

/** Cercle respiratoire : inspiration 4 s, expiration 6 s. */
export function BreathingCircle({ elapsedMs, running, size }: { elapsedMs: number; running: boolean; size: number }) {
  const { phase, remainingMs } = breathingPhase(elapsedMs);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const target = phase === 'inhale' ? 1 : 0;
    progress.value = withTiming(target, {
      duration: reduceMotion ? 0 : remainingMs,
      easing: Easing.inOut(Easing.sin),
    });
    // Relancé uniquement à chaque changement de phase ou de lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, running, reduceMotion]);

  const outer = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + progress.value * 0.45 }],
    opacity: 0.25 + progress.value * 0.25,
  }));
  const inner = useAnimatedStyle(() => ({ transform: [{ scale: 0.5 + progress.value * 0.4 }] }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLiveRegion="polite"
      accessibilityLabel={phase === 'inhale' ? 'Inspire lentement' : 'Expire doucement'}
    >
      <Animated.View
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary }, outer]}
      />
      <Animated.View
        style={[
          styles.circle,
          { width: size * 0.8, height: size * 0.8, borderRadius: size, backgroundColor: colors.primarySoft, opacity: 0.35 },
          inner,
        ]}
      />
      <Text style={[typography.title, styles.label]}>{phase === 'inhale' ? 'Inspire…' : 'Expire…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
  label: { textAlign: 'center' },
});
