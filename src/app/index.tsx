import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { WeekStrip } from '@/components/DayStatus';
import { Flame } from '@/components/Flame';
import { Icon, IconName } from '@/components/Icon';
import { Button, Card, haptic, ProgressBar, Screen } from '@/components/ui';
import { formatOfDay } from '@/domain/dates';
import { goalLabel } from '@/domain/goals';
import { FREE_LIMITS } from '@/domain/premium';
import { JOKER_MAX_BALANCE, VALIDATION_OPEN_HOUR } from '@/domain/rules';
import { lastDays } from '@/domain/streak';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

function NavTile({ icon, label, href }: { icon: IconName; label: string; href: '/progress' | '/rewards' | '/settings' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic('light');
        router.push(href);
      }}
      style={({ pressed }) => [styles.navTile, pressed && { opacity: 0.8 }]}
    >
      <Icon name={icon} color={colors.primarySoft} />
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const app = useApp();
  const { ready, profile, streak, today, flameTier, next, pendingDays, protectable, uncelebrated, currentGoal } = app;

  // Célébrer un nouveau palier dès le retour sur l'accueil.
  useFocusEffect(
    useCallback(() => {
      if (uncelebrated.length > 0) router.push('/celebration');
    }, [uncelebrated.length]),
  );

  if (!ready) return null;
  if (!profile?.onboardingCompleted || !streak) return <Redirect href="/onboarding" />;

  const week = lastDays(streak, today, 7);
  const pending = pendingDays[0];
  const todayRecorded = app.snapshot.entries.some((entry) => entry.date === today);
  const jokers = streak.jokers.balance;
  const protectableDay = jokers > 0 ? protectable[0] : undefined;

  const confirmJoker = () => {
    if (!protectableDay) return;
    Alert.alert(
      'Utiliser un joker ?',
      `Le joker protégera la journée ${formatOfDay(protectableDay, today)} : ta série ne sera pas interrompue, mais cette journée ne comptera pas comme réussie.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Utiliser le joker',
          onPress: async () => {
            const result = await app.applyJoker(protectableDay);
            if (result.eligibility.ok) haptic('success');
            else Alert.alert('Joker indisponible', 'Cette journée ne peut plus être protégée.');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.fill}>
          <Text style={typography.caption}>SugarFlame</Text>
          <Text style={typography.heading} numberOfLines={2}>
            {currentGoal ? goalLabel(currentGoal) : 'Ton objectif'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réglages"
          onPress={() => router.push('/settings')}
          style={styles.iconButton}
        >
          <Icon name="settings" color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Flame
          tier={flameTier}
          size={190}
          accessibilityLabel={`Flamme ${flameTier.name}, série de ${plural(streak.current, 'jour')}`}
        />
        <Text style={styles.streakValue} accessibilityRole="header">
          {plural(streak.current, 'jour')}
        </Text>
        <Text style={typography.body}>
          {streak.current === 0 ? 'Ta série commence ce soir.' : 'de série en cours'} · Record : {streak.best}
        </Text>
      </View>

      <Button
        label="J'ai envie de sucre"
        size="lg"
        accessibilityHint="Ouvre une pause guidée pour traverser l'envie"
        onPress={() => router.push('/sos')}
      />

      {pending ? (
        <Card style={styles.validationCard}>
          <Text style={typography.heading}>Bilan {formatOfDay(pending, today)}</Text>
          <Text style={typography.body}>As-tu respecté ton objectif ?</Text>
          <Button label="Faire le bilan" onPress={() => router.push({ pathname: '/validation', params: { date: pending } })} />
        </Card>
      ) : !todayRecorded ? (
        <Card>
          <View style={styles.row}>
            <Icon name="clock" color={colors.textMuted} />
            <Text style={[typography.body, styles.fill]}>
              Le bilan du jour s’ouvre à {VALIDATION_OPEN_HOUR} h. Tu recevras un rappel
              {profile.notificationsEnabled ? ` à ${profile.reminderHour} h${String(profile.reminderMinute).padStart(2, '0')}` : ' si tu actives les notifications'}.
            </Text>
          </View>
        </Card>
      ) : (
        <Card>
          <View style={styles.row}>
            <Icon name="check" color={colors.success} />
            <Text style={[typography.body, styles.fill]}>Bilan du jour enregistré. À demain !</Text>
          </View>
          <Button
            label="Modifier"
            variant="ghost"
            onPress={() => router.push({ pathname: '/validation', params: { date: today } })}
          />
        </Card>
      )}

      {protectableDay ? (
        <Card style={styles.jokerCard}>
          <View style={styles.row}>
            <Icon name="shield" color={colors.joker} />
            <Text style={[typography.bodyStrong, styles.fill]}>Protéger ta série</Text>
          </View>
          <Text style={typography.body}>
            {`La journée ${formatOfDay(protectableDay, today)} n’a pas été réussie. Tu peux utiliser un de tes jokers (${jokers}/${JOKER_MAX_BALANCE}) pour ne pas interrompre ta série.`}
          </Text>
          <Button label="Utiliser un joker" variant="secondary" onPress={confirmJoker} />
        </Card>
      ) : null}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={typography.bodyStrong}>
            {next.next ? `Prochain palier : ${next.next.name}` : 'Tous les paliers atteints !'}
          </Text>
          {next.next ? <Text style={typography.caption}>{plural(next.remaining, 'jour')}</Text> : null}
        </View>
        <ProgressBar
          progress={next.progress}
          accessibilityLabel={next.next ? `Progression vers ${next.next.name}` : 'Progression complète'}
        />
        <View style={styles.rowBetween}>
          <Text style={typography.caption}>
            Jokers : {jokers}/{JOKER_MAX_BALANCE}
          </Text>
          <Text style={typography.caption}>
            {app.canStartSos ? `${FREE_LIMITS.sosPausesPerDay} pause guidée offerte aujourd’hui` : 'Pause guidée du jour utilisée'}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={typography.bodyStrong}>Les 7 derniers jours</Text>
        <WeekStrip days={week} today={today} />
      </Card>

      <View style={styles.navRow}>
        <NavTile icon="chart" label="Progression" href="/progress" />
        <NavTile icon="trophy" label="Récompenses" href="/rewards" />
        <NavTile icon="settings" label="Réglages" href="/settings" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', gap: spacing.xs },
  streakValue: { fontSize: 44, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  validationCard: { borderWidth: 1, borderColor: colors.primary },
  jokerCard: { borderWidth: 1, borderColor: colors.jokerMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  navRow: { flexDirection: 'row', gap: spacing.md },
  navTile: {
    flex: 1,
    minHeight: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  navLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
