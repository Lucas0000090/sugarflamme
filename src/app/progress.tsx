import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { Legend, MonthCalendar } from '@/components/DayStatus';
import { Card, EmptyState, Screen, SectionTitle, StatTile } from '@/components/ui';
import { startOfMonth } from '@/domain/dates';
import { REWARD_TIERS } from '@/domain/rewards';
import { averageIntensities } from '@/domain/sos';
import { SosSession } from '@/db/repository';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme';

const CHART_SESSIONS = 10;

function IntensityChart({ sessions }: { sessions: SosSession[] }) {
  const [width, setWidth] = useState(0);
  const height = 160;
  const padding = 24;
  const data = sessions.slice(-CHART_SESSIONS);
  const slot = data.length > 0 ? (width - padding) / data.length : 0;
  const barWidth = Math.max(4, Math.min(14, slot / 3));
  const y = (value: number) => height - padding - (value / 10) * (height - padding * 1.5);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Intensité avant et après les ${data.length} dernières pauses : ${data
        .map((session) => `${session.intensityBefore} puis ${session.intensityAfter ?? 'non renseigné'}`)
        .join(', ')}`}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 5, 10].map((tick) => (
            <Line key={tick} x1={padding} x2={width} y1={y(tick)} y2={y(tick)} stroke={colors.border} strokeWidth={1} />
          ))}
          {[0, 5, 10].map((tick) => (
            <SvgText key={`t${tick}`} x={4} y={y(tick) + 4} fill={colors.textMuted} fontSize={10}>
              {tick}
            </SvgText>
          ))}
          {data.map((session, index) => {
            const x = padding + index * slot + slot / 2;
            return (
              <G key={session.id}>
                <Rect
                  x={x - barWidth - 1}
                  y={y(session.intensityBefore)}
                  width={barWidth}
                  height={height - padding - y(session.intensityBefore)}
                  rx={3}
                  fill={colors.primary}
                />
                {session.intensityAfter !== null ? (
                  <Rect
                    x={x + 1}
                    y={y(session.intensityAfter)}
                    width={barWidth}
                    height={height - padding - y(session.intensityAfter)}
                    rx={3}
                    fill={colors.joker}
                  />
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text style={typography.caption}>Avant la pause</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.joker }]} />
          <Text style={typography.caption}>Après la pause</Text>
        </View>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { snapshot, streak, today, profile } = useApp();
  const [month, setMonth] = useState(startOfMonth(today));

  if (!streak || !profile) return null;

  const sessions = snapshot.sosSessions;
  const averages = averageIntensities(sessions);
  const badges = REWARD_TIERS.filter((tier) => snapshot.rewards.some((reward) => reward.tierDays === tier.days));
  const hasHistory = snapshot.entries.length > 0;

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={styles.tiles}>
        <StatTile value={String(streak.current)} label="Série actuelle" accent={colors.primarySoft} />
        <StatTile value={String(streak.best)} label="Record" />
        <StatTile value={String(streak.totalSuccess)} label="Jours réussis" />
        <StatTile value={String(sessions.length)} label="Pauses SOS" />
      </View>

      <Card>
        <MonthCalendar
          month={month}
          statusOf={streak.statusOf}
          today={today}
          minMonth={profile.startDate}
          onChangeMonth={setMonth}
        />
        <Legend />
        {!hasHistory ? (
          <Text style={typography.caption}>Ton premier bilan apparaîtra ici ce soir.</Text>
        ) : null}
      </Card>

      <SectionTitle>Envies de sucre</SectionTitle>
      <Card>
        {sessions.length === 0 ? (
          <EmptyState
            title="Aucune pause pour le moment"
            message="Quand une envie arrive, appuie sur « J’ai envie de sucre ». L’évolution de tes intensités s’affichera ici."
          />
        ) : (
          <>
            {averages ? (
              <Text style={typography.body}>
                En moyenne, ton envie passe de{' '}
                <Text style={typography.bodyStrong}>{averages.before.toFixed(1).replace('.', ',')}</Text> à{' '}
                <Text style={typography.bodyStrong}>{averages.after.toFixed(1).replace('.', ',')}</Text> après une pause
                ({averages.count} pause{averages.count > 1 ? 's' : ''} complète{averages.count > 1 ? 's' : ''}).
              </Text>
            ) : (
              <Text style={typography.body}>Termine une pause pour voir l’évolution de ton envie.</Text>
            )}
            <IntensityChart sessions={sessions} />
            <Text style={typography.caption}>Les {Math.min(CHART_SESSIONS, sessions.length)} dernières pauses.</Text>
          </>
        )}
      </Card>

      <SectionTitle>Récompenses acquises</SectionTitle>
      <Card>
        {badges.length === 0 ? (
          <EmptyState title="Pas encore de badge" message="Ton premier badge, Étincelle, arrive après 3 jours réussis de suite." />
        ) : (
          <View style={styles.badges}>
            {badges.map((tier) => (
              <View key={tier.id} style={[styles.badgePill, { borderColor: tier.palette.middle }]}>
                <Text style={[typography.caption, { color: colors.text }]}>{tier.name}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
      <Text style={[typography.caption, { textAlign: 'center' }]}>
        Jokers disponibles : {streak.jokers.balance} · Journées protégées : {streak.jokers.validUses.length}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chartLegend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgePill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
