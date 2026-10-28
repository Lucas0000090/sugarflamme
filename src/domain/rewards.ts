/** Paliers de récompenses et apparences de flamme. */

export type TierId = 'braise' | 'etincelle' | 'petite-flamme' | 'feu-grandissant' | 'brasier' | 'feu-violet' | 'legendaire';

export interface FlamePalette {
  outer: string;
  middle: string;
  inner: string;
  core: string;
  glow: string;
}

export interface RewardTier {
  id: TierId;
  /** Série nécessaire. 0 = apparence de départ (pas un badge). */
  days: number;
  name: string;
  description: string;
  palette: FlamePalette;
  /** Taille relative de la flamme. */
  scale: number;
  /** Nombre d'étincelles animées autour de la flamme. */
  sparks: number;
}

export const BASE_TIER: RewardTier = {
  id: 'braise',
  days: 0,
  name: 'Braise',
  description: 'Le point de départ. Chaque journée réussie attise la flamme.',
  palette: { outer: '#9A3412', middle: '#C2410C', inner: '#EA580C', core: '#FDBA74', glow: '#7C2D12' },
  scale: 0.72,
  sparks: 0,
};

export const REWARD_TIERS: readonly RewardTier[] = [
  {
    id: 'etincelle',
    days: 3,
    name: 'Étincelle',
    description: 'Trois jours de suite : la flamme prend vie.',
    palette: { outer: '#EA580C', middle: '#F97316', inner: '#FB923C', core: '#FED7AA', glow: '#C2410C' },
    scale: 0.8,
    sparks: 2,
  },
  {
    id: 'petite-flamme',
    days: 7,
    name: 'Petite flamme',
    description: 'Une semaine complète. Tu gagnes ton premier joker.',
    palette: { outer: '#F97316', middle: '#FB923C', inner: '#FDBA74', core: '#FFF7ED', glow: '#EA580C' },
    scale: 0.86,
    sparks: 3,
  },
  {
    id: 'feu-grandissant',
    days: 14,
    name: 'Feu grandissant',
    description: 'Deux semaines : une vraie habitude se dessine.',
    palette: { outer: '#DC2626', middle: '#F97316', inner: '#FBBF24', core: '#FEF3C7', glow: '#B91C1C' },
    scale: 0.92,
    sparks: 4,
  },
  {
    id: 'brasier',
    days: 30,
    name: 'Brasier',
    description: 'Un mois entier. Ta détermination rayonne.',
    palette: { outer: '#B91C1C', middle: '#EF4444', inner: '#F59E0B', core: '#FFFBEB', glow: '#991B1B' },
    scale: 0.97,
    sparks: 6,
  },
  {
    id: 'feu-violet',
    days: 60,
    name: 'Feu violet',
    description: 'Deux mois. Une flamme rare, à ton image.',
    palette: { outer: '#6D28D9', middle: '#8B5CF6', inner: '#C084FC', core: '#F5F3FF', glow: '#5B21B6' },
    scale: 1,
    sparks: 7,
  },
  {
    id: 'legendaire',
    days: 100,
    name: 'Flamme légendaire',
    description: 'Cent jours. Une flamme que peu de gens atteignent.',
    palette: { outer: '#0EA5E9', middle: '#38BDF8', inner: '#FDE68A', core: '#FFFFFF', glow: '#0369A1' },
    scale: 1.04,
    sparks: 9,
  },
];

export function tierByDays(days: number): RewardTier | undefined {
  return REWARD_TIERS.find((tier) => tier.days === days);
}

/** Apparence correspondant à une série. */
export function tierForStreak(streak: number): RewardTier {
  let result = BASE_TIER;
  for (const tier of REWARD_TIERS) if (streak >= tier.days) result = tier;
  return result;
}

/** Prochain palier et progression (0 → 1) depuis le palier précédent. */
export function nextTierProgress(streak: number): {
  next: RewardTier | null;
  previousDays: number;
  progress: number;
  remaining: number;
} {
  const next = REWARD_TIERS.find((tier) => tier.days > streak) ?? null;
  const previousDays = tierForStreak(streak).days;
  if (!next) return { next: null, previousDays, progress: 1, remaining: 0 };
  const span = next.days - previousDays;
  return {
    next,
    previousDays,
    progress: Math.min(1, Math.max(0, (streak - previousDays) / span)),
    remaining: next.days - streak,
  };
}

/** Paliers atteints par une série mais pas encore débloqués. */
export function newlyReachedTiers(bestStreak: number, unlocked: ReadonlySet<number>): RewardTier[] {
  return REWARD_TIERS.filter((tier) => bestStreak >= tier.days && !unlocked.has(tier.days));
}
