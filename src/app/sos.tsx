import { router, useNavigation, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BreathingCircle } from '@/components/BreathingCircle';
import { Icon } from '@/components/Icon';
import { IntensityPicker } from '@/components/IntensityPicker';
import { Button, Card, haptic, ProgressBar, Screen } from '@/components/ui';
import { toDateKey } from '@/domain/dates';
import { FREE_LIMITS, PREMIUM_OFFER } from '@/domain/premium';
import { SOS_EXTENSION_SECONDS, SOS_PAUSE_SECONDS } from '@/domain/rules';
import { intensityFeedback } from '@/domain/sos';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

type Step = 'before' | 'pause' | 'after' | 'result';

const GUIDANCE = [
  'Observe l’envie, sans la juger.',
  'Elle monte, puis redescend, comme une vague.',
  'Tu n’as rien à décider maintenant.',
  'Relâche les épaules, desserre la mâchoire.',
  'Remarque ce que tu ressens dans ton corps.',
  'Tu prends soin de toi en ce moment même.',
];

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function SosScreen() {
  const app = useApp();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>('before');
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [planned, setPlanned] = useState(SOS_PAUSE_SECONDS);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Le chronomètre repose sur l'horloge réelle : pas de dérive si l'app ralentit.
  const accumulated = useRef(0);
  const resumedAt = useRef<number | null>(null);
  const startedAt = useRef<Date | null>(null);
  const finishedNotified = useRef(false);
  // Limite décidée à l'ouverture de l'écran (la session en cours ne la consomme pas).
  const [allowed] = useState(app.canStartSos);

  const currentElapsed = useCallback(
    () => accumulated.current + (resumedAt.current !== null ? Date.now() - resumedAt.current : 0),
    [],
  );

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const elapsed = currentElapsed();
      if (elapsed < planned * 1000) {
        setElapsedMs(elapsed);
        return;
      }
      // Fin de la pause.
      accumulated.current = planned * 1000;
      resumedAt.current = null;
      setElapsedMs(planned * 1000);
      setRunning(false);
      if (!finishedNotified.current) {
        finishedNotified.current = true;
        haptic('success');
      }
    }, 200);
    return () => clearInterval(interval);
  }, [running, planned, currentElapsed]);

  const remaining = planned - elapsedMs / 1000;
  const finished = step === 'pause' && remaining <= 0;

  const startPause = () => {
    startedAt.current = new Date();
    accumulated.current = 0;
    resumedAt.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
    setStep('pause');
  };

  const togglePause = () => {
    if (running) {
      accumulated.current = currentElapsed();
      resumedAt.current = null;
      setElapsedMs(accumulated.current);
      setRunning(false);
    } else if (!finished) {
      resumedAt.current = Date.now();
      setRunning(true);
    }
  };

  const extend = () => {
    finishedNotified.current = false;
    setPlanned((value) => value + SOS_EXTENSION_SECONDS);
    if (!running) {
      resumedAt.current = Date.now();
      setRunning(true);
    }
  };

  const save = async (intensityAfter: number | null, completed: boolean) => {
    if (before === null || !startedAt.current) return;
    const end = new Date();
    await app.saveSos({
      date: toDateKey(startedAt.current),
      startedAt: startedAt.current.toISOString(),
      endedAt: end.toISOString(),
      intensityBefore: before,
      intensityAfter,
      plannedSeconds: planned,
      elapsedSeconds: Math.round(Math.min(currentElapsed(), planned * 1000) / 1000),
      completed,
    });
  };

  const goToAfter = () => {
    accumulated.current = currentElapsed();
    resumedAt.current = null;
    setRunning(false);
    setStep('after');
  };

  const confirmQuit = (onQuit: () => void) => {
    Alert.alert('Quitter la pause ?', 'Ce que tu as déjà fait compte. Tu pourras revenir quand tu veux.', [
      { text: 'Rester', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          await save(null, false).catch(() => undefined);
          onQuit();
        },
      },
    ]);
  };

  // Retour Android / geste pendant la pause : on demande confirmation.
  const inSession = step === 'pause' || step === 'after';
  usePreventRemove(inSession && !exiting, ({ data }) => {
    confirmQuit(() => navigation.dispatch(data.action));
  });

  // La sortie se fait après le rendu qui désactive la protection ci-dessus.
  useEffect(() => {
    if (exiting) close();
  }, [exiting]);

  const submitAfter = async () => {
    if (after === null) return;
    setSaving(true);
    try {
      await save(after, true);
      setStep('result');
    } catch {
      Alert.alert('Enregistrement impossible', 'La session n’a pas pu être enregistrée. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  const circleSize = Math.min(width - spacing.xl * 2, 300);

  if (!allowed) {
    return (
      <Screen>
        <TopBar onClose={close} />
        <Text style={typography.title} accessibilityRole="header">
          Ta pause guidée du jour est déjà utilisée
        </Text>
        <Text style={typography.body}>
          L’offre gratuite comprend {FREE_LIMITS.sosPausesPerDay} pause guidée par jour. Tu peux quand même traverser cette
          envie avec ces gestes simples :
        </Text>
        <Card>
          {[
            'Respire lentement : 4 secondes pour inspirer, 6 pour expirer, pendant une minute.',
            'Bois un grand verre d’eau.',
            'Change de pièce ou sors marcher quelques minutes.',
            'Occupe tes mains : range, écris, envoie un message à un proche.',
          ].map((tip) => (
            <View key={tip} style={styles.tip}>
              <Icon name="check" size={18} color={colors.primarySoft} />
              <Text style={[typography.body, { flex: 1 }]}>{tip}</Text>
            </View>
          ))}
        </Card>
        <Card style={{ borderWidth: 1, borderColor: colors.border }}>
          <Text style={typography.bodyStrong}>Bientôt : SugarFlame Premium</Text>
          <Text style={typography.body}>
            Pauses illimitées et accompagnement personnalisé ({PREMIUM_OFFER.monthlyPrice} ou {PREMIUM_OFFER.yearlyPrice}).
            Pas encore disponible dans cette version.
          </Text>
        </Card>
        <Button label="Revenir à l’accueil" onPress={close} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar onClose={() => (inSession ? confirmQuit(() => setExiting(true)) : close())} />

      {step === 'before' ? (
        <Animated.View entering={FadeIn} style={styles.section}>
          <Text style={typography.title} accessibilityRole="header">
            Une envie de sucre ?
          </Text>
          <Text style={typography.body}>
            C’est normal, et ça passe. Prenons 90 secondes ensemble. D’abord : quelle est l’intensité de ton envie ?
          </Text>
          <IntensityPicker value={before} onChange={setBefore} />
          <Button label="Commencer la pause" size="lg" disabled={before === null} onPress={startPause} />
        </Animated.View>
      ) : null}

      {step === 'pause' ? (
        <Animated.View entering={FadeIn} style={[styles.section, styles.centered]}>
          <Text style={[typography.body, styles.textCenter]} accessibilityLiveRegion="polite">
            {finished ? 'Pause terminée. Bravo d’avoir pris ce temps.' : GUIDANCE[Math.floor(elapsedMs / 15000) % GUIDANCE.length]}
          </Text>
          <BreathingCircle elapsedMs={elapsedMs} running={running} size={circleSize} />
          <Text
            style={styles.clock}
            accessibilityLabel={`Temps restant : ${Math.max(0, Math.ceil(remaining))} secondes`}
          >
            {formatClock(remaining)}
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar progress={elapsedMs / 1000 / planned} accessibilityLabel="Progression de la pause" />
          </View>
          <View style={styles.controls}>
            {!finished ? (
              <Button
                label={running ? 'Pause' : 'Reprendre'}
                variant="secondary"
                icon={<Icon name={running ? 'pause' : 'play'} size={18} />}
                onPress={togglePause}
                style={styles.control}
              />
            ) : null}
            <Button
              label={`+${SOS_EXTENSION_SECONDS} s`}
              variant="secondary"
              accessibilityHint="Prolonge la pause de 30 secondes"
              icon={<Icon name="plus" size={18} />}
              onPress={extend}
              style={styles.control}
            />
          </View>
          <Button
            label={finished ? 'Continuer' : 'J’ai terminé'}
            variant={finished ? 'primary' : 'ghost'}
            size={finished ? 'lg' : 'md'}
            onPress={goToAfter}
            style={{ alignSelf: 'stretch' }}
          />
        </Animated.View>
      ) : null}

      {step === 'after' ? (
        <Animated.View entering={FadeIn} style={styles.section}>
          <Text style={typography.title} accessibilityRole="header">
            Et maintenant ?
          </Text>
          <Text style={typography.body}>Quelle est l’intensité de ton envie après cette pause ?</Text>
          <IntensityPicker value={after} onChange={setAfter} />
          <Button label="Voir mon bilan" size="lg" disabled={after === null} loading={saving} onPress={submitAfter} />
        </Animated.View>
      ) : null}

      {step === 'result' && before !== null && after !== null ? (
        <Animated.View entering={FadeIn} style={styles.section}>
          <Text style={typography.title} accessibilityRole="header">
            {intensityFeedback(before, after).title}
          </Text>
          <View style={styles.compare}>
            <Gauge label="Avant" value={before} />
            <Icon name="chevronRight" color={colors.textMuted} />
            <Gauge label="Après" value={after} />
          </View>
          <Text style={typography.body}>{intensityFeedback(before, after).message}</Text>
          <Text style={typography.caption}>
            Cette pause n’est pas comptée comme un bilan de journée : tu feras ton bilan ce soir.
          </Text>
          <Button label="Revenir à l’accueil" size="lg" onPress={close} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

function TopBar({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.topBar}>
      <Text style={typography.label}>SOS sucre</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} style={styles.closeButton}>
        <Icon name="close" color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.gauge} accessible accessibilityLabel={`${label} : ${value} sur 10`}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={styles.gaugeValue}>{value}</Text>
      <Text style={typography.caption}>/ 10</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.lg },
  centered: { alignItems: 'center' },
  textCenter: { textAlign: 'center', minHeight: 46 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: { fontSize: 40, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  control: { flex: 1 },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  gauge: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, minWidth: 110 },
  gaugeValue: { fontSize: 44, fontWeight: '900', color: colors.primarySoft },
});
