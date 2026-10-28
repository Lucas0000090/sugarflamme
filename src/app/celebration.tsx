import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Flame } from '@/components/Flame';
import { Button, haptic } from '@/components/ui';
import { RewardTier } from '@/domain/rewards';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme';

function Ray({ index, count, color }: { index: number; count: number; color: string }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      index * 40,
      withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 0 })), 3),
    );
  }, [index, progress, reduceMotion]);
  const angle = (index / count) * Math.PI * 2;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * progress.value * 150 },
      { translateY: Math.sin(angle) * progress.value * 150 },
      { scale: 1 - progress.value * 0.5 },
    ],
  }));
  return <Animated.View style={[styles.ray, { backgroundColor: color }, style]} />;
}

export default function CelebrationScreen() {
  const { uncelebrated, markCelebrated } = useApp();
  // Figé à l'ouverture : la liste se vide quand on marque les badges comme célébrés.
  const [tiers] = useState<RewardTier[]>(() => uncelebrated);
  const top = tiers[tiers.length - 1];
  const scale = useSharedValue(0.4);

  useEffect(() => {
    if (!top) return;
    haptic('success');
    scale.value = withSpring(1, { damping: 9, stiffness: 120 });
  }, [scale, top]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const close = async () => {
    await markCelebrated(tiers.map((tier) => tier.days));
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!top) {
    return (
      <SafeAreaView style={styles.container}>
        <Button label="Fermer" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} accessibilityViewIsModal>
      <View style={styles.burst} pointerEvents="none">
        {Array.from({ length: 14 }, (_, index) => (
          <Ray key={index} index={index} count={14} color={index % 2 ? top.palette.inner : top.palette.middle} />
        ))}
      </View>
      <Animated.View style={flameStyle}>
        <Flame tier={top} size={220} accessibilityLabel={`Nouvelle flamme : ${top.name}`} />
      </Animated.View>
      <Text style={typography.label}>Nouveau palier · {top.days} jours</Text>
      <Text style={[typography.hero, styles.center]} accessibilityRole="header">
        {top.name}
      </Text>
      <Text style={[typography.body, styles.center]}>{top.description}</Text>
      {tiers.length > 1 ? (
        <Text style={[typography.caption, styles.center]}>
          Badges débloqués : {tiers.map((tier) => tier.name).join(', ')}
        </Text>
      ) : null}
      <Text style={[typography.caption, styles.center]}>Ce badge est à toi pour toujours.</Text>
      <Button label="Continuer" size="lg" onPress={() => void close()} style={styles.button} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  burst: { position: 'absolute', top: '38%', left: '50%' },
  ray: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.lg },
});
