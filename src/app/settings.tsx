import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { TimePicker } from '@/components/TimePicker';
import { Button, Card, Choice, haptic, Screen, SectionTitle } from '@/components/ui';
import { LATEST_SCHEMA_VERSION } from '@/db/migrations';
import { formatLongDate } from '@/domain/dates';
import { CUSTOM_GOAL_MAX_LENGTH, GOAL_OPTIONS, goalLabel, GoalType } from '@/domain/goals';
import { PREMIUM_OFFER } from '@/domain/premium';
import { getPermissionState, PermissionState } from '@/services/notifications';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
    >
      <Text style={typography.bodyStrong}>{label}</Text>
      <Icon name="chevronRight" color={colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const app = useApp();
  const { profile, currentGoal, scheduledGoal } = app;
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshPermission = useCallback(() => {
    void getPermissionState().then(setPermission);
  }, []);
  useFocusEffect(refreshPermission);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  if (!profile) return null;

  const toggleNotifications = async (enabled: boolean) => {
    setBusy(true);
    const result = await app.setNotificationsEnabled(enabled);
    setPermission(result);
    setBusy(false);
    if (enabled && result !== 'granted') {
      Alert.alert(
        'Notifications désactivées',
        'Autorise les notifications de SugarFlame dans les réglages de ton téléphone pour recevoir le rappel du soir.',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  };

  const saveGoal = async () => {
    if (!goalType) return;
    const label = goalType === 'custom' ? customLabel.trim() : null;
    setBusy(true);
    try {
      if (currentGoal && currentGoal.type === goalType && (goalType !== 'custom' || currentGoal.customLabel === label)) {
        await app.cancelGoalChange();
      } else {
        const effectiveFrom = await app.changeGoal(goalType, label);
        Alert.alert('Objectif enregistré', `Ton nouvel objectif s’appliquera à partir de ${formatLongDate(effectiveFrom)}.`);
      }
      haptic('success');
      setEditingGoal(false);
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Supprimer toutes les données ?',
      'Ta série, tes bilans, tes pauses SOS et tes badges seront définitivement effacés de ce téléphone. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: async () => {
            await app.resetAll();
            if (router.canDismiss()) router.dismissAll();
            router.replace('/onboarding');
          },
        },
      ],
    );
  };

  const notificationsOn = profile.notificationsEnabled && permission === 'granted';
  const goalValid = goalType !== null && (goalType !== 'custom' || customLabel.trim().length >= 3);

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <SectionTitle>Objectif</SectionTitle>
      <Card>
        <Text style={typography.label}>En cours</Text>
        <Text style={typography.bodyStrong}>{currentGoal ? goalLabel(currentGoal) : '—'}</Text>
        {scheduledGoal ? (
          <View style={styles.scheduled}>
            <Text style={typography.body}>
              À partir de {formatLongDate(scheduledGoal.effectiveFrom)} :{' '}
              <Text style={typography.bodyStrong}>{goalLabel(scheduledGoal)}</Text>
            </Text>
            <Button label="Annuler ce changement" variant="ghost" onPress={() => void app.cancelGoalChange()} />
          </View>
        ) : null}
        {!editingGoal ? (
          <Button
            label="Modifier l’objectif"
            variant="secondary"
            onPress={() => {
              setGoalType(scheduledGoal?.type ?? currentGoal?.type ?? null);
              setCustomLabel(scheduledGoal?.customLabel ?? currentGoal?.customLabel ?? '');
              setEditingGoal(true);
            }}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.caption}>Le changement prendra effet demain, pour ne pas fausser la journée en cours.</Text>
            {GOAL_OPTIONS.map((option) => (
              <Choice
                key={option.type}
                title={option.title}
                selected={goalType === option.type}
                onPress={() => setGoalType(option.type)}
              />
            ))}
            {goalType === 'custom' ? (
              <TextInput
                value={customLabel}
                onChangeText={setCustomLabel}
                placeholder="Ton objectif personnel"
                placeholderTextColor={colors.textMuted}
                maxLength={CUSTOM_GOAL_MAX_LENGTH}
                style={styles.input}
                accessibilityLabel="Ton objectif personnel"
              />
            ) : null}
            <Button label="Enregistrer" onPress={() => void saveGoal()} disabled={!goalValid} loading={busy} />
            <Button label="Annuler" variant="ghost" onPress={() => setEditingGoal(false)} />
          </View>
        )}
      </Card>

      <SectionTitle>Rappel du soir</SectionTitle>
      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>Notification quotidienne</Text>
            <Text style={typography.caption}>« As-tu respecté ton objectif aujourd’hui ? »</Text>
          </View>
          <Switch
            value={notificationsOn}
            disabled={busy}
            onValueChange={(value) => void toggleNotifications(value)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.text}
            accessibilityLabel="Activer le rappel quotidien"
          />
        </View>
        {permission === 'denied' ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.body}>
              Les notifications sont bloquées pour SugarFlame. Tu peux les autoriser dans les réglages de ton téléphone.
            </Text>
            <Button label="Ouvrir les réglages du téléphone" variant="secondary" onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
        {notificationsOn ? (
          <TimePicker
            hour={profile.reminderHour}
            minute={profile.reminderMinute}
            onChange={(hour, minute) => void app.setReminderTime(hour, minute)}
          />
        ) : null}
      </Card>

      <SectionTitle>SugarFlame Premium</SectionTitle>
      <Card>
        {app.isPremium ? (
          <>
            <Text style={typography.bodyStrong}>Premium actif</Text>
            <Text style={typography.body}>Pauses SOS illimitées, statistiques détaillées et choix de la flamme.</Text>
            <Button label="Mon abonnement" variant="secondary" onPress={() => router.push('/premium')} />
          </>
        ) : (
          <>
            <Text style={typography.bodyStrong}>Offre gratuite</Text>
            <Text style={typography.body}>
              Série quotidienne, badges, bilan du soir, une pause SOS par jour et statistiques de base.
            </Text>
            {PREMIUM_OFFER.features.map((feature) => (
              <View key={feature.title} style={styles.feature}>
                <Icon name="lock" size={16} color={colors.textMuted} />
                <Text style={typography.body}>{feature.title}</Text>
              </View>
            ))}
            <Button label="Découvrir Premium" onPress={() => router.push('/premium')} />
          </>
        )}
      </Card>

      <SectionTitle>Aide et informations</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        <LinkRow label="Règles des séries" onPress={() => router.push('/rules')} />
        <LinkRow label="Confidentialité" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
        <LinkRow label="Mentions légales" onPress={() => router.push({ pathname: '/legal', params: { doc: 'legal' } })} />
      </Card>

      <SectionTitle>Données</SectionTitle>
      <Card>
        <Text style={typography.body}>Toutes tes données restent sur ce téléphone. Aucun compte, aucun envoi.</Text>
        <Button label="Supprimer mes données" variant="danger" onPress={confirmReset} />
      </Card>

      <Text style={[typography.caption, { textAlign: 'center' }]}>
        SugarFlame version {Constants.expoConfig?.version ?? '—'} · schéma {LATEST_SCHEMA_VERSION}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scheduled: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkRow: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.primary,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
  },
});
