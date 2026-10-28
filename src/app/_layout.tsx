import * as Notifications from 'expo-notifications';
import { DarkTheme, ErrorBoundaryProps, router, Stack, ThemeProvider, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { migrate } from '@/db/migrations';
import { dismissNotification, parseNotificationResponse } from '@/services/notifications';
import { AppProvider, useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    primary: colors.primary,
    border: colors.background,
  },
};

/** Ouvre l'écran de validation quand on touche un rappel (app ouverte ou fermée). */
function NotificationResponder() {
  const { ready, profile, record } = useApp();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const handled = useRef(new Set<string>());
  const recordRef = useRef(record);
  const canHandle = ready && navigationReady && Boolean(profile?.onboardingCompleted);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  useEffect(() => {
    if (!canHandle) return;
    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const intent = parseNotificationResponse(response);
      const key = `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
      if (!intent || handled.current.has(key)) return;
      handled.current.add(key);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      if (!intent.answer) {
        router.push({ pathname: '/validation', params: { date: intent.date } });
        return;
      }
      // Action rapide « Oui » / « Pas aujourd'hui » : on enregistre puis on affiche le résultat.
      void dismissNotification(intent.notificationId);
      try {
        const result = await recordRef.current(intent.date, intent.answer);
        router.push({
          pathname: '/validation',
          params: result.decision.ok
            ? { date: intent.date, saved: intent.answer }
            : { date: intent.date, error: result.decision.reason },
        });
      } catch {
        router.push({ pathname: '/validation', params: { date: intent.date } });
      }
    };
    void handle(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => void handle(response));
    return () => subscription.remove();
  }, [canHandle]);

  return null;
}

function HideSplashWhenReady() {
  const { ready } = useApp();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return null;
}

function RootNavigator() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Accueil' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="sos" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="validation" options={{ title: 'Bilan du jour', presentation: 'modal' }} />
        <Stack.Screen
          name="celebration"
          options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="progress" options={{ title: 'Progression' }} />
        <Stack.Screen name="rewards" options={{ title: 'Récompenses' }} />
        <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
        <Stack.Screen name="rules" options={{ title: 'Règles des séries' }} />
        <Stack.Screen name="legal" options={{ title: 'Informations' }} />
        <Stack.Screen name="premium" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      <NotificationResponder />
      <HideSplashWhenReady />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <SQLiteProvider databaseName="sugarflame.db" onInit={migrate}>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </SQLiteProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Écran affiché si une erreur inattendue survient (ex. base de données illisible). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <Text style={typography.title}>Oups, un souci est survenu</Text>
      <Text style={typography.body}>
        SugarFlame n’a pas pu s’ouvrir correctement. Tes données restent sur ton téléphone. Tu peux réessayer.
      </Text>
      <Text style={typography.caption}>{error.message}</Text>
      <Button label="Réessayer" onPress={() => void retry()} />
    </View>
  );
}
