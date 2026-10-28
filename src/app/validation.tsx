import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Flame } from '@/components/Flame';
import { Icon } from '@/components/Icon';
import { Button, Card, haptic, Screen } from '@/components/ui';
import { addDays, DateKey, formatOfDay, formatOnDay, formatTime, isDateKey } from '@/domain/dates';
import { goalForDate, goalLabel } from '@/domain/goals';
import { CORRECTION_WINDOW_DAYS, JOKER_MAX_BALANCE } from '@/domain/rules';
import { canUseJoker, EntryStatus, isWithinCorrectionWindow } from '@/domain/streak';
import { isTodayValidationOpen, RECORD_ERROR_MESSAGES } from '@/domain/validation';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme';

type Outcome = { kind: 'saved'; status: EntryStatus } | { kind: 'later'; at: Date | null } | { kind: 'error'; message: string };

function closeScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ValidationScreen() {
  const app = useApp();
  // `saved` / `error` : réponse déjà traitée depuis une action rapide de notification.
  const params = useLocalSearchParams<{ date?: string; saved?: string; error?: string }>();
  const [outcome, setOutcome] = useState<Outcome | null>(() => {
    if (params.saved === 'success' || params.saved === 'failure') return { kind: 'saved', status: params.saved };
    if (params.error && params.error in RECORD_ERROR_MESSAGES) {
      return { kind: 'error', message: RECORD_ERROR_MESSAGES[params.error as keyof typeof RECORD_ERROR_MESSAGES] };
    }
    return null;
  });
  const [busy, setBusy] = useState(false);

  const { today, profile, snapshot } = app;
  const date: DateKey = params.date && isDateKey(params.date) ? params.date : today;
  const existing = snapshot.entries.find((entry) => entry.date === date) ?? null;
  const goal = goalForDate(snapshot.goals, date);
  const editable = isWithinCorrectionWindow(date, today);
  const notYetOpen = date === today && !isTodayValidationOpen(new Date()) && !existing;

  const submit = async (status: EntryStatus) => {
    setBusy(true);
    try {
      const result = await app.record(date, status);
      if (!result.decision.ok) {
        setOutcome({ kind: 'error', message: RECORD_ERROR_MESSAGES[result.decision.reason] });
        haptic('warning');
        return;
      }
      haptic(status === 'success' ? 'success' : 'light');
      setOutcome({ kind: 'saved', status });
    } catch {
      setOutcome({ kind: 'error', message: 'L’enregistrement a échoué. Réessaie dans un instant.' });
    } finally {
      setBusy(false);
    }
  };

  const later = async () => {
    setBusy(true);
    const at = profile?.notificationsEnabled ? await app.postpone(date) : null;
    setBusy(false);
    setOutcome({ kind: 'later', at });
  };

  if (!profile) return null;

  const streakInput = { startDate: profile.startDate, today, entries: snapshot.entries, jokerUses: snapshot.jokerUses };
  const jokerBalance = app.streak?.jokers.balance ?? 0;
  const isProtected = snapshot.jokerUses.some((use) => use.protectedDate === date);
  const jokerAllowed = canUseJoker(streakInput, date).ok;

  const confirmJoker = () => {
    Alert.alert(
      'Utiliser un joker ?',
      'Ta série ne sera pas interrompue, mais cette journée ne comptera pas comme réussie.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Utiliser le joker',
          onPress: async () => {
            const result = await app.applyJoker(date);
            if (result.eligibility.ok) haptic('success');
          },
        },
      ],
    );
  };

  if (outcome?.kind === 'saved') {
    const success = outcome.status === 'success';
    return (
      <Screen>
        <Animated.View entering={FadeIn} style={styles.center}>
          <Flame tier={app.flameTier} size={success ? 170 : 120} />
          <Text style={[typography.title, styles.textCenter]} accessibilityRole="header">
            {success ? 'Bravo, objectif respecté !' : 'Merci pour ton honnêteté'}
          </Text>
          <Text style={[typography.body, styles.textCenter]}>
            {success
              ? `Ta série est maintenant de ${app.streak?.current ?? 0} jour${(app.streak?.current ?? 0) > 1 ? 's' : ''}. Ta flamme te remercie.`
              : 'Un écart n’efface pas tes progrès : tes badges et ton record restent acquis. Demain est une nouvelle journée.'}
          </Text>
        </Animated.View>
        {!success && !isProtected && jokerAllowed ? (
          <Card style={{ borderWidth: 1, borderColor: colors.jokerMuted }}>
            <View style={styles.row}>
              <Icon name="shield" color={colors.joker} />
              <Text style={typography.bodyStrong}>
                Joker disponible ({jokerBalance}/{JOKER_MAX_BALANCE})
              </Text>
            </View>
            <Text style={typography.body}>Tu peux l’utiliser pour protéger ta série. C’est toi qui décides.</Text>
            <Button label="Utiliser un joker" variant="secondary" onPress={confirmJoker} />
          </Card>
        ) : null}
        {!success && isProtected ? (
          <Card>
            <View style={styles.row}>
              <Icon name="shield" color={colors.joker} />
              <Text style={[typography.body, { flex: 1 }]}>Journée protégée par un joker. Ta série continue.</Text>
            </View>
          </Card>
        ) : null}
        <Text style={[typography.caption, styles.textCenter]}>
          Tu peux corriger ce bilan jusqu’à la fin {formatOfDay(addDays(date, CORRECTION_WINDOW_DAYS), today)}.
        </Text>
        <Button label="Terminer" size="lg" onPress={closeScreen} />
      </Screen>
    );
  }

  if (outcome?.kind === 'later') {
    return (
      <Screen>
        <View style={styles.center}>
          <Icon name="clock" size={48} color={colors.primarySoft} />
          <Text style={[typography.title, styles.textCenter]}>D’accord, plus tard</Text>
          <Text style={[typography.body, styles.textCenter]}>
            {outcome.at
              ? `Nouveau rappel à ${formatTime(outcome.at.getHours(), outcome.at.getMinutes())}.`
              : 'Tu pourras faire ton bilan depuis l’accueil.'}{' '}
            Tu as jusqu’à 48 h après la fin de la journée pour répondre.
          </Text>
        </View>
        <Button label="OK" size="lg" onPress={closeScreen} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={typography.label}>Bilan {formatOfDay(date, today)}</Text>
      <Text style={typography.title} accessibilityRole="header">
        As-tu respecté ton objectif {formatOnDay(date, today)} ?
      </Text>
      {goal ? (
        <Card>
          <Text style={typography.label}>Objectif</Text>
          <Text style={typography.bodyStrong}>{goalLabel(goal)}</Text>
        </Card>
      ) : null}

      {outcome?.kind === 'error' ? (
        <Card style={{ borderWidth: 1, borderColor: colors.danger }}>
          <Text style={typography.body}>{outcome.message}</Text>
        </Card>
      ) : null}

      {existing ? (
        <Card>
          <Text style={typography.body}>
            Réponse enregistrée : <Text style={typography.bodyStrong}>
              {existing.status === 'success' ? 'objectif respecté' : 'pas aujourd’hui'}
            </Text>
            .{' '}
            {editable
              ? `Tu peux encore la corriger jusqu’à la fin ${formatOfDay(addDays(date, CORRECTION_WINDOW_DAYS), today)}.`
              : 'Le délai de correction de 48 h est dépassé.'}
          </Text>
        </Card>
      ) : null}

      {notYetOpen ? (
        <Card>
          <Text style={typography.body}>{RECORD_ERROR_MESSAGES['too-early']}</Text>
        </Card>
      ) : editable ? (
        <View style={styles.actions}>
          <Button
            label="Oui, objectif respecté"
            size="lg"
            icon={<Icon name="check" />}
            loading={busy}
            disabled={existing?.status === 'success'}
            onPress={() => void submit('success')}
          />
          <Button
            label="Pas aujourd’hui"
            variant="secondary"
            size="lg"
            disabled={busy || existing?.status === 'failure'}
            onPress={() => void submit('failure')}
          />
          {!existing ? <Button label="Plus tard" variant="ghost" disabled={busy} onPress={() => void later()} /> : null}
        </View>
      ) : (
        <Button label="Fermer" onPress={closeScreen} />
      )}

      <Text style={[typography.caption, styles.textCenter]}>
        Sois honnête avec toi-même : il n’y a pas de mauvaise réponse, seulement un pas de plus.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  textCenter: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.md },
});
