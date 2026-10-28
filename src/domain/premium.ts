/**
 * Distinction Gratuit / Premium.
 *
 * V1 : aucun achat intégré. Tous les utilisateurs sont sur l'offre gratuite.
 * Pour brancher les achats plus tard (RevenueCat, StoreKit, Play Billing),
 * il suffira de fournir un autre `Entitlements` depuis `src/state` :
 * les écrans ne consultent que `hasFeature` et `FREE_LIMITS`.
 */
export type Plan = 'free' | 'premium';

export type PremiumFeature =
  | 'unlimited-sos'
  | 'personalized-coaching'
  | 'detailed-stats'
  | 'flame-customization';

export interface Entitlements {
  plan: Plan;
}

export const FREE_ENTITLEMENTS: Entitlements = { plan: 'free' };

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

/** Informations affichées (offre envisagée, non achetable en V1). */
export const PREMIUM_OFFER = {
  monthlyPrice: '3,99 €/mois',
  yearlyPrice: '24,99 €/an',
  features: [
    'Pauses SOS illimitées',
    'Accompagnement personnalisé',
    'Statistiques détaillées',
    'Personnalisation de la flamme',
  ],
} as const;
