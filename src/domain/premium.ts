/**
 * Distinction Gratuit / Premium.
 *
 * Les droits viennent de l'abonnement (App Store / Google Play via
 * RevenueCat, voir src/services/purchases.ts). Les écrans ne consultent que
 * `hasFeature`, `canStartSosPause` et `FREE_LIMITS`.
 */
export type Plan = 'free' | 'premium';

/** Fonctions réellement livrées aux abonnés. Ne vendre que ce qui existe. */
export type PremiumFeature = 'unlimited-sos' | 'detailed-stats' | 'flame-customization';

export interface Entitlements {
  plan: Plan;
  /** Fin de la période en cours (ISO), si abonnement. */
  expiresAt?: string | null;
  /** L'abonnement se renouvellera-t-il automatiquement ? */
  willRenew?: boolean;
}

export const FREE_ENTITLEMENTS: Entitlements = { plan: 'free' };

/** Identifiant du droit « premium » configuré dans RevenueCat. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const FREE_LIMITS = {
  /** Pauses guidées SOS par jour sur l'offre gratuite. */
  sosPausesPerDay: 1,
} as const;

export function hasFeature(entitlements: Entitlements, _feature: PremiumFeature): boolean {
  return entitlements.plan === 'premium';
}

export function canStartSosPause(entitlements: Entitlements, pausesToday: number): boolean {
  return hasFeature(entitlements, 'unlimited-sos') || pausesToday < FREE_LIMITS.sosPausesPerDay;
}

/**
 * Prix de référence, affichés seulement quand le store ne répond pas.
 * L'écran d'abonnement affiche toujours le prix réel renvoyé par le store.
 */
export const PREMIUM_OFFER = {
  monthlyPrice: '3,99 €/mois',
  yearlyPrice: '24,99 €/an',
  features: [
    { title: 'Pauses SOS illimitées', description: 'Une pause guidée chaque fois qu’une envie arrive.' },
    {
      title: 'Statistiques détaillées',
      description: 'Taux de réussite, jours difficiles et heures des envies.',
    },
    { title: 'Personnalisation de la flamme', description: 'Choisis l’apparence parmi tes flammes débloquées.' },
  ],
} as const;

/** Économie de l'abonnement annuel par rapport à 12 mois (en %, arrondi). */
export function yearlySavingsPercent(monthlyPrice: number, yearlyPrice: number): number | null {
  if (monthlyPrice <= 0 || yearlyPrice <= 0) return null;
  const saving = 1 - yearlyPrice / (monthlyPrice * 12);
  return saving > 0.01 ? Math.round(saving * 100) : null;
}
