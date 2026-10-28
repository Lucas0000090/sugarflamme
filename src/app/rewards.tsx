import { StyleSheet, Text, View } from 'react-native';

import { Flame } from '@/components/Flame';
import { Card, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { BASE_TIER, nextTierProgress, REWARD_TIERS } from '@/domain/rewards';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function RewardsScreen() {
  const { snapshot, streak, flameTier } = useApp();
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
      <View style={styles.grid}>
        {[BASE_TIER, ...REWARD_TIERS].map((tier) => {
          const reward = unlocked.get(tier.days);
          const isUnlocked = tier.days === 0 || Boolean(reward);
          return (
            <View
              key={tier.id}
              style={[styles.badge, isUnlocked && styles.badgeUnlocked]}
              accessible
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
            </View>
          );
        })}
      </View>
      <Text style={[typography.caption, styles.center]}>
        Les badges débloqués restent acquis, même après un écart. La personnalisation de la flamme arrivera avec
        SugarFlame Premium.
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
  center: { textAlign: 'center' },
});
