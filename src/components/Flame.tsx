import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { FlamePalette, RewardTier } from '@/domain/rewards';

const VIEW_W = 200;
const VIEW_H = 240;

// Silhouette originale : une flamme en goutte avec une langue latérale.
const OUTER =
  'M100 6 C118 44 172 78 172 148 C172 200 140 234 100 234 C60 234 28 200 28 150 C28 112 48 92 62 64 C66 92 76 106 88 112 C80 78 86 38 100 6 Z';
const MIDDLE =
  'M104 66 C116 98 148 120 148 166 C148 202 126 224 100 224 C74 224 52 202 52 170 C52 140 70 126 80 106 C84 128 92 138 102 140 C96 116 96 92 104 66 Z';
const INNER =
  'M100 126 C110 148 128 164 128 190 C128 208 116 220 100 220 C84 220 72 208 72 190 C72 168 92 154 100 126 Z';

const GREY: FlamePalette = { outer: '#334155', middle: '#475569', inner: '#64748B', core: '#94A3B8', glow: '#1E293B' };

interface FlameProps {
  tier: RewardTier;
  size?: number;
  /** Apparence verrouillée (grisée, immobile). */
  locked?: boolean;
  animated?: boolean;
  accessibilityLabel?: string;
}

function Spark({ index, total, color, size }: { index: number; total: number; color: string; size: number }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const left = useMemo(() => 0.22 + ((index * 0.61) % 0.56), [index]);
  const duration = 1800 + ((index * 370) % 900);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      (index * 2600) / Math.max(total, 1),
      withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [duration, index, progress, reduceMotion, total]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.1 ? progress.value * 10 : 1 - progress.value,
    transform: [
      { translateY: -progress.value * size * 0.45 },
      { translateX: Math.sin(progress.value * Math.PI * 2 + index) * size * 0.04 },
      { scale: 1 - progress.value * 0.6 },
    ],
  }));

  if (reduceMotion) return null;
  const dot = Math.max(3, size * 0.025);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        { left: size * left, top: size * 0.62, width: dot, height: dot, borderRadius: dot, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function Flame({ tier, size = 200, locked = false, animated = true, accessibilityLabel }: FlameProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const palette = locked ? GREY : tier.palette;
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !locked && !reduceMotion;

  const flicker = useSharedValue(0);
  const sway = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!shouldAnimate) return;
    flicker.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(flicker);
      cancelAnimation(sway);
      cancelAnimation(glow);
    };
  }, [flicker, glow, shouldAnimate, sway]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + flicker.value * 0.035 }, { rotate: `${sway.value * 1.6}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + (1 - flicker.value) * 0.06 }, { rotate: `${-sway.value * 2.4}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + glow.value * 0.35,
    transform: [{ scale: 0.95 + glow.value * 0.08 }],
  }));

  const scaled = size * tier.scale;
  const width = scaled;
  const height = (scaled * VIEW_H) / VIEW_W;
  const isLegendary = tier.id === 'legendaire' && !locked;

  return (
    <View
      style={{ width: size, height: (size * VIEW_H) / VIEW_W, alignItems: 'center', justifyContent: 'flex-end' }}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <RadialGradient id={`glow${id}`} cx="50%" cy="68%" r="50%">
              <Stop offset="0" stopColor={palette.glow} stopOpacity={locked ? 0.15 : 0.75} />
              <Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={100} cy={160} rx={100} ry={90} fill={`url(#glow${id})`} />
          {isLegendary ? (
            <Circle cx={100} cy={150} r={92} stroke={palette.middle} strokeOpacity={0.35} strokeWidth={2} fill="none" />
          ) : null}
        </Svg>
      </Animated.View>

      <View style={{ width, height }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.origin, outerStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            <Defs>
              <LinearGradient id={`outer${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={palette.middle} />
                <Stop offset="1" stopColor={palette.outer} />
              </LinearGradient>
              <LinearGradient id={`middle${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={palette.inner} />
                <Stop offset="1" stopColor={palette.middle} />
              </LinearGradient>
            </Defs>
            <Path d={OUTER} fill={`url(#outer${id})`} />
            <Path d={MIDDLE} fill={`url(#middle${id})`} />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.origin, innerStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            <Defs>
              <LinearGradient id={`inner${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={palette.core} />
                <Stop offset="1" stopColor={palette.inner} />
              </LinearGradient>
            </Defs>
            <Path d={INNER} fill={`url(#inner${id})`} />
            <Ellipse cx={100} cy={198} rx={13} ry={16} fill={palette.core} opacity={0.9} />
          </Svg>
        </Animated.View>
      </View>

      {shouldAnimate
        ? Array.from({ length: tier.sparks }, (_, index) => (
            <Spark key={index} index={index} total={tier.sparks} color={palette.inner} size={size} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { transformOrigin: 'bottom' },
  spark: { position: 'absolute' },
});
