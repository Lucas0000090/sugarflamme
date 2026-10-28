/* eslint-disable @typescript-eslint/no-require-imports */
// Mock minimal de Reanimated pour les tests de rendu : les animations
// sont exécutées instantanément (valeur finale).
module.exports = (() => {
  const { View, Text, ScrollView } = require('react-native');
  const identity = (value) => value;
  const easing = () => identity;
  const Easing = new Proxy({}, { get: () => easing });
  const layoutAnimation = () => {
    const builder = {};
    for (const key of ['duration', 'delay', 'springify', 'damping', 'withCallback', 'easing']) {
      builder[key] = () => builder;
    }
    return builder;
  };
  const Animated = {
    View,
    Text,
    ScrollView,
    createAnimatedComponent: identity,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    Easing,
    useSharedValue: (initial) => ({ value: initial, get: () => initial, set: () => undefined }),
    useAnimatedStyle: (factory) => factory(),
    useReducedMotion: () => false,
    withTiming: identity,
    withSpring: identity,
    withDelay: (_delay, animation) => animation,
    withRepeat: identity,
    withSequence: (...animations) => animations[animations.length - 1],
    cancelAnimation: () => undefined,
    FadeIn: layoutAnimation(),
    FadeInRight: layoutAnimation(),
    ZoomIn: layoutAnimation(),
  };
})();
