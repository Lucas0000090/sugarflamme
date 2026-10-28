/**
 * Achats intégrés (abonnement Premium) via RevenueCat, qui s'appuie sur
 * l'App Store et Google Play. Les clés publiques du SDK sont fournies par
 * variables d'environnement (EXPO_PUBLIC_REVENUECAT_IOS_KEY /
 * EXPO_PUBLIC_REVENUECAT_ANDROID_KEY). Ce sont des clés publiques prévues
 * pour être embarquées dans l'app : aucune clé secrète n'est utilisée ici.
 *
 * Sans clé (développement), les achats sont simplement indisponibles et
 * l'écran d'abonnement l'indique.
 */
import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  PurchasesPackage,
} from 'react-native-purchases';

import { Entitlements, FREE_ENTITLEMENTS, PREMIUM_ENTITLEMENT_ID } from '@/domain/premium';

export type PlanKind = 'monthly' | 'annual';

export interface PremiumPlan {
  kind: PlanKind;
  /** Prix localisé fourni par le store, ex. « 24,99 € ». */
  priceString: string;
  price: number;
  /** Prix mensuel équivalent pour l'annuel, ex. « 2,08 € ». */
  pricePerMonthString: string | null;
  /** Objet RevenueCat à passer à `purchase`. */
  pkg: PurchasesPackage;
}

export type PurchaseOutcome =
  | { status: 'success'; entitlements: Entitlements }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'error'; message: string };

let configured = false;

function apiKey(): string | undefined {
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

export function purchasesAvailable(): boolean {
  return configured;
}

/** À appeler une fois au démarrage. Retourne false si les achats sont indisponibles. */
export function configurePurchases(): boolean {
  if (configured) return true;
  const key = apiKey();
  if (!key) return false;
  try {
    if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.WARN);
    // Pas de compte : RevenueCat crée un identifiant anonyme sur l'appareil.
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch (error) {
    console.warn('Configuration des achats impossible', error);
  }
  return configured;
}

/** Traduit les informations client RevenueCat en droits de l'app. */
export function entitlementsFromCustomerInfo(
  info: Pick<CustomerInfo, 'entitlements'> | null | undefined,
): Entitlements {
  const premium = info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
  if (!premium || !premium.isActive) return FREE_ENTITLEMENTS;
  return { plan: 'premium', expiresAt: premium.expirationDate ?? null, willRenew: premium.willRenew };
}

export async function fetchEntitlements(): Promise<Entitlements> {
  if (!configured) return FREE_ENTITLEMENTS;
  try {
    return entitlementsFromCustomerInfo(await Purchases.getCustomerInfo());
  } catch {
    return FREE_ENTITLEMENTS;
  }
}

/** Écoute les changements d'abonnement (achat, renouvellement, expiration). */
export function onEntitlementsChange(listener: (entitlements: Entitlements) => void): () => void {
  if (!configured) return () => undefined;
  const handler = (info: CustomerInfo) => listener(entitlementsFromCustomerInfo(info));
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(handler);
  };
}

/** Formules proposées (offre « courante » configurée dans RevenueCat). */
export async function fetchPlans(): Promise<PremiumPlan[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const plans: PremiumPlan[] = [];
  for (const pkg of packages) {
    const kind: PlanKind | null =
      pkg.packageType === PACKAGE_TYPE.ANNUAL ? 'annual' : pkg.packageType === PACKAGE_TYPE.MONTHLY ? 'monthly' : null;
    if (!kind) continue;
    plans.push({
      kind,
      priceString: pkg.product.priceString,
      price: pkg.product.price,
      pricePerMonthString: kind === 'annual' ? pkg.product.pricePerMonthString ?? null : null,
      pkg,
    });
  }
  // Annuel d'abord : c'est la formule mise en avant.
  return plans.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'annual' ? -1 : 1));
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : undefined;
}

export async function purchase(plan: PremiumPlan): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    const entitlements = entitlementsFromCustomerInfo(customerInfo);
    // Paiement différé (ex. accord parental) : l'accès arrivera plus tard.
    return entitlements.plan === 'premium' ? { status: 'success', entitlements } : { status: 'pending' };
  } catch (error) {
    const code = errorCode(error);
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { status: 'cancelled' };
    if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { status: 'pending' };
    if (code === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
      return { status: 'error', message: 'Pas de connexion internet. Vérifie ta connexion et réessaie.' };
    }
    if (code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
      return { status: 'error', message: 'Les achats ne sont pas autorisés sur cet appareil.' };
    }
    return { status: 'error', message: 'L’achat n’a pas pu aboutir. Aucun montant n’a été débité. Réessaie plus tard.' };
  }
}

export async function restore(): Promise<{ ok: true; entitlements: Entitlements } | { ok: false; message: string }> {
  if (!configured) return { ok: false, message: 'Les achats ne sont pas disponibles sur cette version de l’app.' };
  try {
    return { ok: true, entitlements: entitlementsFromCustomerInfo(await Purchases.restorePurchases()) };
  } catch {
    return { ok: false, message: 'La restauration a échoué. Vérifie ta connexion et réessaie.' };
  }
}

/** Ouvre la gestion de l'abonnement du store (changer, annuler). */
export async function openSubscriptionManagement(): Promise<void> {
  if (configured) {
    try {
      const info = await Purchases.getCustomerInfo();
      if (info.managementURL) {
        await Linking.openURL(info.managementURL);
        return;
      }
    } catch {
      // On retombe sur l'adresse générique du store.
    }
  }
  await Linking.openURL(
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions',
  );
}
