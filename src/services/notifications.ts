/**
 * Rappels quotidiens locaux.
 *
 * Plutôt qu'un rappel répétitif identique chaque soir, on programme un
 * rappel daté pour chacun des prochains jours non encore validés. Chaque
 * notification connaît ainsi la journée qu'elle concerne (même si on y
 * répond après minuit) et aucun rappel n'est envoyé pour un jour déjà validé.
 * La liste est resynchronisée à chaque ouverture de l'app et après chaque
 * validation ou changement de réglage.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, DateKey, isDateKey, toDateKey } from '@/domain/dates';
import { CORRECTION_WINDOW_DAYS } from '@/domain/rules';
import { EntryStatus } from '@/domain/streak';

const CHANNEL_ID = 'daily-reminder';
export const VALIDATION_CATEGORY = 'daily-validation';
export const ACTION_SUCCESS = 'validate-success';
export const ACTION_FAILURE = 'validate-failure';

const DAILY_PREFIX = 'daily-';
const LATER_PREFIX = 'later-';
/** Nombre de jours programmés à l'avance (iOS limite à 64 notifications). */
const SCHEDULE_AHEAD_DAYS = 14;
const LATER_DELAY_MINUTES = 60;

const TITLE = 'SugarFlame';
const BODY = 'As-tu respecté ton objectif aujourd’hui ?';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

let configured = false;

/** À appeler une fois au démarrage. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Rappel quotidien',
        description: 'Le bilan du soir pour faire avancer ta série.',
        importance: AndroidImportance.DEFAULT,
      });
    }
    // Actions rapides : elles ouvrent l'application, qui enregistre la
    // réponse elle-même (comportement identique sur iOS et Android, même
    // si l'app était fermée).
    await Notifications.setNotificationCategoryAsync(VALIDATION_CATEGORY, [
      { identifier: ACTION_SUCCESS, buttonTitle: 'Oui, objectif respecté', options: { opensAppToForeground: true } },
      { identifier: ACTION_FAILURE, buttonTitle: 'Pas aujourd’hui', options: { opensAppToForeground: true } },
    ]);
  } catch (error) {
    console.warn('Configuration des notifications impossible', error);
  }
}

function toPermissionState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.granted) return 'granted';
  if (response.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return response.status === 'denied' ? 'denied' : 'undetermined';
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toPermissionState(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

export async function requestPermission(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (toPermissionState(current) === 'granted') return 'granted';
    if (current.status === 'denied' && !current.canAskAgain) return 'denied';
    return toPermissionState(
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }),
    );
  } catch {
    return 'denied';
  }
}

async function cancelByPrefix(prefixes: string[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => prefixes.some((prefix) => request.identifier.startsWith(prefix)))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

function at(date: DateKey, hour: number, minute: number): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

function content(date: DateKey): Notifications.NotificationContentInput {
  return {
    title: TITLE,
    body: BODY,
    data: { kind: 'daily-validation', date },
    categoryIdentifier: VALIDATION_CATEGORY,
  };
}

export async function syncReminders(params: {
  enabled: boolean;
  hour: number;
  minute: number;
  startDate: DateKey;
  recordedDates: ReadonlySet<DateKey>;
  now: Date;
}): Promise<void> {
  try {
    await cancelByPrefix([DAILY_PREFIX]);
    if (!params.enabled || (await getPermissionState()) !== 'granted') {
      await cancelByPrefix([LATER_PREFIX]);
      return;
    }
    const today = toDateKey(params.now);
    for (let offset = 0; offset < SCHEDULE_AHEAD_DAYS; offset += 1) {
      const date = addDays(today, offset);
      if (date < params.startDate || params.recordedDates.has(date)) continue;
      const fireAt = at(date, params.hour, params.minute);
      if (fireAt.getTime() <= params.now.getTime()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${DAILY_PREFIX}${date}`,
        content: content(date),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
      });
    }
  } catch (error) {
    console.warn('Programmation des rappels impossible', error);
  }
}

/** « Plus tard » : un rappel unique une heure plus tard. Retourne l'heure prévue. */
export async function scheduleLaterReminder(date: DateKey, now: Date): Promise<Date | null> {
  if ((await getPermissionState()) !== 'granted') return null;
  const fireAt = new Date(now.getTime() + LATER_DELAY_MINUTES * 60_000);
  // Inutile de rappeler après la fin du délai de saisie.
  if (toDateKey(fireAt) > addDays(date, CORRECTION_WINDOW_DAYS)) return null;
  try {
    await Notifications.cancelScheduledNotificationAsync(`${LATER_PREFIX}${date}`).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: `${LATER_PREFIX}${date}`,
      content: content(date),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
    });
    return fireAt;
  } catch {
    return null;
  }
}

export async function cancelLaterReminder(date: DateKey): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${LATER_PREFIX}${date}`).catch(() => undefined);
}

export async function cancelAllReminders(): Promise<void> {
  await cancelByPrefix([DAILY_PREFIX, LATER_PREFIX]).catch(() => undefined);
}

export interface ValidationIntent {
  date: DateKey;
  answer: EntryStatus | null;
  notificationId: string;
}

/** Traduit une interaction avec une notification en intention de validation. */
export function parseNotificationResponse(response: Notifications.NotificationResponse): ValidationIntent | null {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.kind !== 'daily-validation') return null;
  const date =
    typeof data.date === 'string' && isDateKey(data.date) ? data.date : toDateKey(new Date(response.notification.date));
  const answer =
    response.actionIdentifier === ACTION_SUCCESS
      ? 'success'
      : response.actionIdentifier === ACTION_FAILURE
        ? 'failure'
        : null;
  return { date, answer, notificationId: response.notification.request.identifier };
}

export async function dismissNotification(identifier: string): Promise<void> {
  await Notifications.dismissNotificationAsync(identifier).catch(() => undefined);
}
