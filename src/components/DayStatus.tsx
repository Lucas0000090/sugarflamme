import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addMonths,
  DateKey,
  dateRange,
  dayOfMonth,
  daysInMonth,
  formatLongDate,
  formatMonthTitle,
  startOfMonth,
  WEEKDAY_HEADERS,
  weekdayIndex,
  weekdayShort,
} from '@/domain/dates';
import { DayStatus } from '@/domain/streak';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

import { Icon } from './Icon';

export const STATUS_LABELS: Record<DayStatus, string> = {
  success: 'objectif respecté',
  failure: 'pas aujourd’hui',
  protected: 'protégée par un joker',
  pending: 'à renseigner',
  missed: 'non renseignée',
  inactive: 'hors suivi',
};

const STATUS_STYLE: Record<DayStatus, { bg: string; fg: string; border?: string }> = {
  success: { bg: colors.primary, fg: colors.text },
  failure: { bg: colors.failureMuted, fg: colors.textSecondary },
  protected: { bg: colors.jokerMuted, fg: colors.joker, border: colors.joker },
  pending: { bg: 'transparent', fg: colors.textSecondary, border: colors.border },
  missed: { bg: 'transparent', fg: colors.textMuted, border: colors.failureMuted },
  inactive: { bg: 'transparent', fg: colors.border },
};

export function DayBubble({ status, label, size = 38 }: { status: DayStatus; label: string; size?: number }) {
  const style = STATUS_STYLE[status];
  return (
    <View
      style={[
        bubbleStyles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: style.bg,
          borderColor: style.border ?? 'transparent',
        },
      ]}
    >
      {status === 'success' ? (
        <Icon name="check" size={size * 0.5} color={style.fg} />
      ) : status === 'protected' ? (
        <Icon name="shield" size={size * 0.45} color={style.fg} />
      ) : (
        <Text style={[bubbleStyles.label, { color: style.fg }]}>{label}</Text>
      )}
    </View>
  );
}

export function WeekStrip({ days, today }: { days: { date: DateKey; status: DayStatus }[]; today: DateKey }) {
  return (
    <View style={bubbleStyles.week}>
      {days.map(({ date, status }) => (
        <View
          key={date}
          style={bubbleStyles.weekDay}
          accessible
          accessibilityLabel={`${date === today ? "Aujourd'hui" : formatLongDate(date)} : ${STATUS_LABELS[status]}`}
        >
          <Text style={[typography.caption, date === today && { color: colors.primarySoft, fontWeight: '700' }]}>
            {weekdayShort(date)}
          </Text>
          <DayBubble status={status} label={String(dayOfMonth(date))} />
        </View>
      ))}
    </View>
  );
}

export function Legend() {
  const items: DayStatus[] = ['success', 'failure', 'protected', 'pending'];
  return (
    <View style={bubbleStyles.legend}>
      {items.map((status) => (
        <View key={status} style={bubbleStyles.legendItem}>
          <DayBubble status={status} label="" size={16} />
          <Text style={typography.caption}>{STATUS_LABELS[status]}</Text>
        </View>
      ))}
    </View>
  );
}

export function MonthCalendar({
  month,
  statusOf,
  today,
  minMonth,
  onChangeMonth,
}: {
  month: DateKey;
  statusOf: (date: DateKey) => DayStatus;
  today: DateKey;
  minMonth: DateKey;
  onChangeMonth: (month: DateKey) => void;
}) {
  const first = startOfMonth(month);
  const last = `${first.slice(0, 8)}${String(daysInMonth(first)).padStart(2, '0')}`;
  const leading = weekdayIndex(first);
  const cells: (DateKey | null)[] = [...Array.from({ length: leading }, () => null), ...dateRange(first, last)];
  while (cells.length % 7 !== 0) cells.push(null);
  const canPrev = first > startOfMonth(minMonth);
  const canNext = first < startOfMonth(today);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={bubbleStyles.monthHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
          disabled={!canPrev}
          onPress={() => onChangeMonth(addMonths(first, -1))}
          style={[bubbleStyles.navButton, !canPrev && { opacity: 0.3 }]}
        >
          <Icon name="chevronLeft" />
        </Pressable>
        <Text style={typography.heading} accessibilityRole="header">
          {formatMonthTitle(first)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          disabled={!canNext}
          onPress={() => onChangeMonth(addMonths(first, 1))}
          style={[bubbleStyles.navButton, !canNext && { opacity: 0.3 }]}
        >
          <Icon name="chevronRight" />
        </Pressable>
      </View>
      <View style={bubbleStyles.grid}>
        {WEEKDAY_HEADERS.map((label, index) => (
          <Text key={`h${index}`} style={[typography.caption, bubbleStyles.cell, { textAlign: 'center' }]}>
            {label}
          </Text>
        ))}
        {cells.map((date, index) => (
          <View
            key={date ?? `e${index}`}
            style={bubbleStyles.cell}
            accessible={Boolean(date)}
            accessibilityLabel={date ? `${formatLongDate(date)} : ${STATUS_LABELS[statusOf(date)]}` : undefined}
          >
            {date ? <DayBubble status={statusOf(date)} label={String(dayOfMonth(date))} size={34} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  label: { fontSize: 13, fontWeight: '600' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
});
