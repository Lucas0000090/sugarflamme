import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Flame } from '@/components/Flame';
import { Button, Card, Choice, haptic, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { BASE_TIER, nextTierProgress, REWARD_TIERS } from '@/domain/rewards';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function RewardsScreen() {
  const { snapshot, streak, flameTier, isPremium, profile, setFlamePreference } = useApp();
  const preference = profile?.flamePreference ?? null;
  const current = streak?.current ?? 0;
  const unlocked = new Map(snapshot.rewards.map((reward) => [reward.tierDays, reward]));
  const next = nextTierProgress(current);
  const count = REWARD_TIERS.filter((tier) => unlocked.has(tier.days)).length;

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Card style={styles.hero}>
        <Flame tier={flameTier} size={130} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={typography.label}>Flamme actuelle</Text>
          <Text style={typography.heading}>{flameTier.name}</Text>
          <Text style={typography.caption}>
            {count}/{REWARD_TIERS.length} badges débloqués
          </Text>
        </View>
      </Card>

      {next.next ? (
        <Card>
          <Text style={typography.bodyStrong}>
            Prochain objectif : {next.next.name} ({next.next.days} jours)
          </Text>
          <ProgressBar progress={next.progress} accessibilityLabel={`Progression vers ${next.next.name}`} />
          <Text style={typography.caption}>
            Encore {next.remaining} jour{next.remaining > 1 ? 's' : ''} réussi{next.remaining > 1 ? 's' : ''} de suite.
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Paliers</SectionTitle>
      {isPremium ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.body}>Choisis la flamme affichée sur l’accueil parmi celles que tu as débloquées.</Text>
          <Choice
            title="Automatique"
            description="La flamme suit ta série en cours."
            selected={preference === null}
            onPress={() => void setFlamePreference(null)}
          />
        </View>
      ) : (
        <Card style={{ borderWidth: 1, borderColor: colors.primaryMuted }}>
          <Text style={typography.bodyStrong}>Personnalise ta flamme</Text>
          <Text style={typography.body}>Avec Premium, choisis l’apparence de ta flamme parmi celles que tu as débloquées.</Text>
          <Button label="Découvrir Premium" variant="secondary" onPress={() => router.push('/premium')} />
        </Card>
      )}
      <View style={styles.grid}>
        {[BASE_TIER, ...REWARD_TIERS].map((tier) => {
          const reward = unlocked.get(tier.days);
          const isUnlocked = tier.days === 0 || Boolean(reward);
          const isChosen = isPremium && preference === tier.days;
          return (
            <Pressable
              key={tier.id}
              disabled={!isPremium || !isUnlocked}
              onPress={() => {
                haptic('light');
                void setFlamePreference(tier.days);
              }}
              style={[styles.badge, isUnlocked && styles.badgeUnlocked, isChosen && styles.badgeChosen]}
              accessibilityRole={isPremium && isUnlocked ? 'radio' : undefined}
              accessibilityState={isPremium && isUnlocked ? { checked: isChosen } : undefined}
              accessibilityLabel={`${tier.name}, ${tier.days === 0 ? 'apparence de départ' : `${tier.days} jours`}, ${
                isUnlocked ? 'débloqué' : 'à débloquer'
              }`}
            >
              <Flame tier={tier} size={86} locked={!isUnlocked} animated={false} />
              <Text style={[typography.bodyStrong, styles.center]}>{tier.name}</Text>
              <Text style={[typography.caption, styles.center]}>
                {tier.days === 0
                  ? 'Départ'
                  : reward
                    ? `Débloqué le ${formatDate(reward.unlockedAt)}`
                    : `${tier.days} jours de série`}
              </Text>
              {isChosen ? <Text style={styles.chosen}>Flamme affichée</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={[typography.caption, styles.center]}>
        Les badges débloqués restent acquis, même après un écart.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badge: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    opacity: 0.75,
  },
  badgeUnlocked: { opacity: 1, borderWidth: 1, borderColor: colors.primaryMuted },
  badgeChosen: { borderWidth: 2, borderColor: colors.primary },
  chosen: { color: colors.primarySoft, fontSize: 12, fontWeight: '700' },
  center: { textAlign: 'center' },
});
