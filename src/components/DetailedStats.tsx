import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DateKey } from '@/domain/dates';
import {
  cravingsByPeriod,
  DAY_PERIODS,
  hardestWeekday,
  peakPeriod,
  successRate,
  WEEKDAY_LABELS,
  weekdayRates,
} from '@/domain/stats';
import { StreakSummary } from '@/domain/streak';
import { colors, radius, spacing, typography } from '@/theme';

import { Icon } from './Icon';
import { Button, Card } from './ui';

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)} %`);

function Bar({ label, value, caption }: { label: string; value: number | null; caption: string }) {
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${label} : ${caption}`}>
      <Text style={[typography.caption, styles.barLabel]}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round((value ?? 0) * 100)}%` }]} />
      </View>
      <Text style={[typography.caption, styles.barValue]}>{caption}</Text>
    </View>
  );
}

/** Statistiques détaillées réservées aux abonnés Premium. */
export function DetailedStats({
  summary,
  startDate,
  today,
  sessions,
}: {
  summary: StreakSummary;
  startDate: DateKey;
  today: DateKey;
  sessions: readonly { startedAt: string }[];
}) {
  const last30 = successRate(summary, startDate, today, 30);
  const last7 = successRate(summary, startDate, today, 7);
  const weekdays = weekdayRates(summary, startDate, today);
  const hardest = hardestWeekday(weekdays);
  const periods = cravingsByPeriod(sessions);
  const peak = peakPeriod(periods);
  const maxPeriod = Math.max(1, ...DAY_PERIODS.map((period) => periods[period.id]));

  return (
    <>
      <Card>
        <Text style={typography.bodyStrong}>Taux de réussite</Text>
        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{percent(last7.rate)}</Text>
            <Text style={typography.caption}>7 derniers jours</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{percent(last30.rate)}</Text>
            <Text style={typography.caption}>30 derniers jours</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={typography.bodyStrong}>Réussite par jour de la semaine</Text>
        {weekdays.map((item, index) => (
          <Bar
            key={WEEKDAY_LABELS[index]}
            label={WEEKDAY_LABELS[index] ?? ''}
            value={item.rate}
            caption={item.total === 0 ? '—' : `${item.success}/${item.total}`}
          />
        ))}
        <Text style={typography.caption}>
          {hardest !== null
            ? `Le ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][hardest]} est ton jour le plus difficile : prévois une pause SOS ou un en-cas sans sucre ce jour-là.`
            : 'Encore quelques bilans et tu verras tes jours les plus difficiles.'}
        </Text>
      </Card>

      <Card>
        <Text style={typography.bodyStrong}>Quand arrivent tes envies</Text>
        {sessions.length === 0 ? (
          <Text style={typography.body}>Utilise le bouton SOS quand une envie arrive pour voir tes moments sensibles.</Text>
        ) : (
          <>
            {DAY_PERIODS.map((period) => (
              <Bar
                key={period.id}
                label={period.label}
                value={periods[period.id] / maxPeriod}
                caption={String(periods[period.id])}
              />
            ))}
            {peak ? (
              <Text style={typography.caption}>
                {`Tes envies arrivent surtout : ${DAY_PERIODS.find((p) => p.id === peak)?.label.toLowerCase()} (${DAY_PERIODS.find((p) => p.id === peak)?.hours}).`}
              </Text>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

/** Aperçu verrouillé pour l'offre gratuite. */
export function DetailedStatsTeaser() {
  return (
    <Card style={{ borderWidth: 1, borderColor: colors.primaryMuted }}>
      <View style={styles.teaserTitle}>
        <Icon name="lock" size={18} color={colors.primarySoft} />
        <Text style={typography.bodyStrong}>Statistiques détaillées</Text>
      </View>
      <Text style={typography.body}>
        Taux de réussite sur 7 et 30 jours, tes jours les plus difficiles et les moments où tes envies arrivent.
      </Text>
      <Button label="Débloquer avec Premium" onPress={() => router.push('/premium')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  tileValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 72 },
  barTrack: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  barValue: { width: 40, textAlign: 'right' },
  teaserTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
