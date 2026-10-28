import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Flame } from '@/components/Flame';
import { Icon } from '@/components/Icon';
import { TimePicker } from '@/components/TimePicker';
import { Button, Card, Choice, haptic, Screen } from '@/components/ui';
import { CRAVING_MOMENTS, CravingMoment, CUSTOM_GOAL_MAX_LENGTH, GOAL_OPTIONS, GoalType } from '@/domain/goals';
import { BASE_TIER, REWARD_TIERS } from '@/domain/rewards';
import { DEFAULT_REMINDER_HOUR } from '@/domain/rules';
import { requestPermission } from '@/services/notifications';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme';

const STEPS = 5;

function Dots({ step }: { step: number }) {
  return (
    <View style={styles.dots} accessible accessibilityLabel={`Étape ${step + 1} sur ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, index) => (
        <View key={index} style={[styles.dot, index === step && styles.dotActive, index < step && styles.dotDone]} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [moment, setMoment] = useState<CravingMoment | null>(null);
  const [hour, setHour] = useState(DEFAULT_REMINDER_HOUR);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const canContinue =
    step === 1 ? goal !== null && (goal !== 'custom' || customLabel.trim().length >= 3) : step === 2 ? moment !== null : true;

  const finish = async (withNotifications: boolean) => {
    if (!goal || !moment) return;
    setSaving(true);
    let notificationsEnabled = false;
    if (withNotifications) {
      const permission = await requestPermission();
      notificationsEnabled = permission === 'granted';
      if (!notificationsEnabled) {
        setPermissionDenied(true);
        setSaving(false);
        return;
      }
    }
    try {
      await completeOnboarding({
        goalType: goal,
        customLabel: goal === 'custom' ? customLabel.trim() : null,
        cravingMoment: moment,
        reminderHour: hour,
        reminderMinute: minute,
        notificationsEnabled,
      });
      haptic('success');
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  const next = () => setStep((value) => Math.min(STEPS - 1, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={styles.content}>
        <Dots step={step} />
        <Animated.View key={step} entering={FadeInRight.duration(250)} style={styles.step}>
          {step === 0 ? (
            <View style={styles.center}>
              <Flame tier={REWARD_TIERS[1] ?? BASE_TIER} size={220} />
              <Text style={[typography.hero, styles.textCenter]} accessibilityRole="header">
                SugarFlame
              </Text>
              <Text style={[typography.title, styles.textCenter, { color: colors.primarySoft }]}>
                Réduis tes envies de sucre, un jour à la fois.
              </Text>
              <Text style={[typography.body, styles.textCenter]}>
                Une pause guidée quand l’envie arrive, un bilan chaque soir et une flamme qui grandit avec toi.
              </Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.list}>
              <Text style={typography.title} accessibilityRole="header">
                Quel est ton objectif ?
              </Text>
              <Text style={typography.body}>Tu pourras le modifier plus tard dans les réglages.</Text>
              {GOAL_OPTIONS.map((option) => (
                <Choice
                  key={option.type}
                  title={option.title}
                  description={option.description}
                  selected={goal === option.type}
                  onPress={() => setGoal(option.type)}
                />
              ))}
              {goal === 'custom' ? (
                <TextInput
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="Ex. : pas de biscuits au bureau"
                  placeholderTextColor={colors.textMuted}
                  maxLength={CUSTOM_GOAL_MAX_LENGTH}
                  style={styles.input}
                  accessibilityLabel="Ton objectif personnel"
                  autoFocus
                  returnKeyType="done"
                />
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.list}>
              <Text style={typography.title} accessibilityRole="header">
                Quand les envies arrivent-elles le plus souvent ?
              </Text>
              <Text style={typography.body}>Cela nous aide à mieux t’accompagner.</Text>
              {CRAVING_MOMENTS.map((item) => (
                <Choice
                  key={item.value}
                  title={item.label}
                  description={item.hint}
                  selected={moment === item.value}
                  onPress={() => setMoment(item.value)}
                />
              ))}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.list}>
              <Text style={typography.title} accessibilityRole="header">
                Ta flamme, ta série, tes récompenses
              </Text>
              <View style={styles.flameRow}>
                {[REWARD_TIERS[0], REWARD_TIERS[2], REWARD_TIERS[4]].map((tier) =>
                  tier ? <Flame key={tier.id} tier={tier} size={84} /> : null,
                )}
              </View>
              <Card>
                <Text style={typography.bodyStrong}>🔥 La série</Text>
                <Text style={typography.body}>
                  Chaque soir, tu indiques si tu as respecté ton objectif. Chaque journée réussie fait grandir ta série et ta
                  flamme.
                </Text>
              </Card>
              <Card>
                <Text style={typography.bodyStrong}>🏅 Les récompenses</Text>
                <Text style={typography.body}>
                  À 3, 7, 14, 30, 60 et 100 jours, tu débloques une nouvelle flamme et un badge qui reste à toi, même après un
                  écart.
                </Text>
              </Card>
              <Card>
                <View style={styles.row}>
                  <Icon name="shield" color={colors.joker} />
                  <Text style={typography.bodyStrong}>Les jokers</Text>
                </View>
                <Text style={typography.body}>
                  Tous les 7 jours réussis, tu gagnes un joker (2 maximum). Il protège ta série lors d’une journée difficile.
                </Text>
              </Card>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.list}>
              <Text style={typography.title} accessibilityRole="header">
                Ton rappel du soir
              </Text>
              <Text style={typography.body}>
                Chaque soir, une notification te demandera : « As-tu respecté ton objectif aujourd’hui ? »
              </Text>
              <Card>
                <TimePicker
                  hour={hour}
                  minute={minute}
                  onChange={(h, m) => {
                    setHour(h);
                    setMinute(m);
                  }}
                />
              </Card>
              {permissionDenied ? (
                <Card style={{ borderWidth: 1, borderColor: colors.border }}>
                  <Text style={typography.bodyStrong}>Notifications refusées</Text>
                  <Text style={typography.body}>
                    Pas de souci : tu pourras faire ton bilan depuis l’accueil, et activer les rappels plus tard dans les
                    réglages.
                  </Text>
                </Card>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.footer}>
          {step < STEPS - 1 ? (
            <Button label={step === 0 ? 'Commencer' : 'Continuer'} onPress={next} disabled={!canContinue} size="lg" />
          ) : permissionDenied ? (
            <Button label="Continuer sans rappel" onPress={() => void finish(false)} loading={saving} size="lg" />
          ) : (
            <>
              <Button label="Activer le rappel" onPress={() => void finish(true)} loading={saving} size="lg" />
              <Button label="Pas maintenant" variant="ghost" onPress={() => void finish(false)} disabled={saving} />
            </>
          )}
          {step > 0 ? <Button label="Retour" variant="ghost" onPress={back} disabled={saving} /> : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', paddingVertical: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 28, backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.primarySoft },
  step: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xl },
  textCenter: { textAlign: 'center' },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flameRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.lg },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
  },
});
