import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Flame } from '@/components/Flame';
import { Icon } from '@/components/Icon';
import { Button, Card, haptic, Screen } from '@/components/ui';
import { LINKS } from '@/config';
import { PREMIUM_OFFER, yearlySavingsPercent } from '@/domain/premium';
import { REWARD_TIERS } from '@/domain/rewards';
import * as purchases from '@/services/purchases';
import { useApp } from '@/state/AppProvider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';

type LoadState = { kind: 'loading' } | { kind: 'ready'; plans: purchases.PremiumPlan[] } | { kind: 'unavailable' };

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function PremiumScreen() {
  const app = useApp();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selected, setSelected] = useState<purchases.PlanKind>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!purchases.purchasesAvailable()) return { kind: 'unavailable' } as const;
    try {
      const plans = await purchases.fetchPlans();
      return plans.length > 0 ? ({ kind: 'ready', plans } as const) : ({ kind: 'unavailable' } as const);
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const retry = () => {
    setState({ kind: 'loading' });
    void load().then(setState);
  };

  const plans = state.kind === 'ready' ? state.plans : [];
  const plan = plans.find((item) => item.kind === selected) ?? plans[0];
  const monthly = plans.find((item) => item.kind === 'monthly');
  const annual = plans.find((item) => item.kind === 'annual');
  const savings = monthly && annual ? yearlySavingsPercent(monthly.price, annual.price) : null;

  const buy = async () => {
    if (!plan) return;
    setBusy('buy');
    setMessage(null);
    const outcome = await purchases.purchase(plan);
    setBusy(null);
    if (outcome.status === 'success') {
      app.setEntitlements(outcome.entitlements);
      haptic('success');
    } else if (outcome.status === 'pending') {
      setMessage({ tone: 'info', text: 'Paiement en attente de validation. Premium s’activera dès qu’il sera confirmé.' });
    } else if (outcome.status === 'error') {
      setMessage({ tone: 'error', text: outcome.message });
    }
  };

  const restore = async () => {
    setBusy('restore');
    setMessage(null);
    const result = await purchases.restore();
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message });
      return;
    }
    app.setEntitlements(result.entitlements);
    setMessage(
      result.entitlements.plan === 'premium'
        ? { tone: 'info', text: 'Ton abonnement Premium a été restauré.' }
        : { tone: 'info', text: 'Aucun abonnement actif n’a été trouvé pour ce compte.' },
    );
  };

  const store = Platform.OS === 'ios' ? 'Apple' : 'Google Play';

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={typography.label}>SugarFlame Premium</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={close} style={styles.closeButton}>
          <Icon name="close" color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Flame tier={REWARD_TIERS[4] ?? REWARD_TIERS[0]!} size={150} />
        <Text style={[typography.title, styles.center]} accessibilityRole="header">
          {app.isPremium ? 'Tu es Premium' : 'Va plus loin avec Premium'}
        </Text>
        <Text style={[typography.body, styles.center]}>
          {app.isPremium
            ? 'Merci de soutenir SugarFlame. Toutes les fonctions Premium sont actives.'
            : 'Plus d’aide quand l’envie arrive, et une vision claire de tes progrès.'}
        </Text>
      </View>

      <Card>
        {PREMIUM_OFFER.features.map((feature) => (
          <View key={feature.title} style={styles.feature}>
            <View style={styles.check}>
              <Icon name="check" size={16} color={colors.background} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{feature.title}</Text>
              <Text style={typography.caption}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </Card>

      {app.isPremium ? (
        <Card>
          <Text style={typography.bodyStrong}>Ton abonnement</Text>
          {app.entitlements.expiresAt ? (
            <Text style={typography.body}>
              {app.entitlements.willRenew ? 'Prochain renouvellement le ' : 'Actif jusqu’au '}
              {formatDate(app.entitlements.expiresAt)}.
            </Text>
          ) : null}
          <Button
            label="Gérer mon abonnement"
            variant="secondary"
            onPress={() => void purchases.openSubscriptionManagement()}
          />
        </Card>
      ) : state.kind === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={typography.caption}>Chargement des offres…</Text>
        </View>
      ) : state.kind === 'unavailable' ? (
        <Card style={{ borderWidth: 1, borderColor: colors.border }}>
          <Text style={typography.bodyStrong}>Abonnement indisponible pour le moment</Text>
          <Text style={typography.body}>
            {app.purchasesAvailable
              ? 'Les offres n’ont pas pu être chargées. Vérifie ta connexion internet et réessaie.'
              : 'Les achats ne sont pas activés sur cette version de l’app (version de test).'}
          </Text>
          {app.purchasesAvailable ? <Button label="Réessayer" variant="secondary" onPress={retry} /> : null}
        </Card>
      ) : (
        <View style={{ gap: spacing.md }} accessibilityRole="radiogroup" accessibilityLabel="Formules d'abonnement">
          {plans.map((item) => {
            const isSelected = plan?.kind === item.kind;
            const title = item.kind === 'annual' ? 'Annuel' : 'Mensuel';
            const price = `${item.priceString} / ${item.kind === 'annual' ? 'an' : 'mois'}`;
            return (
              <Pressable
                key={item.kind}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${title}, ${price}`}
                onPress={() => {
                  haptic('light');
                  setSelected(item.kind);
                }}
                style={[styles.plan, isSelected && styles.planSelected]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.planTitleRow}>
                    <Text style={typography.bodyStrong}>{title}</Text>
                    {item.kind === 'annual' && savings ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>−{savings} %</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.pricePerMonthString ? (
                    <Text style={typography.caption}>soit {item.pricePerMonthString} par mois</Text>
                  ) : null}
                </View>
                <Text style={typography.bodyStrong}>{price}</Text>
              </Pressable>
            );
          })}
          <Button
            label="S’abonner"
            size="lg"
            loading={busy === 'buy'}
            disabled={busy !== null || !plan}
            onPress={() => void buy()}
          />
        </View>
      )}

      {message ? (
        <Card style={{ borderWidth: 1, borderColor: message.tone === 'error' ? colors.danger : colors.border }}>
          <Text style={typography.body} accessibilityLiveRegion="polite">
            {message.text}
          </Text>
        </Card>
      ) : null}

      {!app.isPremium ? (
        <Button
          label="Restaurer mes achats"
          variant="ghost"
          loading={busy === 'restore'}
          disabled={busy !== null}
          onPress={() => void restore()}
        />
      ) : null}

      <Text style={[typography.caption, styles.center]}>
        Abonnement à renouvellement automatique. Le paiement est débité sur ton compte {store} à la confirmation de
        l’achat. L’abonnement se renouvelle automatiquement au même prix, sauf annulation au moins 24 heures avant la fin
        de la période en cours. Tu peux le gérer ou l’annuler à tout moment dans les réglages de ton compte {store}.
      </Text>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LINKS.terms)} style={styles.link}>
          <Text style={styles.linkText}>Conditions d’utilisation</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LINKS.privacy)} style={styles.link}>
          <Text style={styles.linkText}>Confidentialité</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  feature: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  loading: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  linkText: { color: colors.primarySoft, fontWeight: '600', textDecorationLine: 'underline' },
});
