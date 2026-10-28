/** Objectifs personnels et moments d'envie. */
import { DateKey } from './dates';

export type GoalType = 'between-meals' | 'desserts' | 'drinks' | 'custom';

export interface GoalOption {
  type: GoalType;
  title: string;
  description: string;
}

export const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    type: 'between-meals',
    title: 'Éviter les sucreries entre les repas',
    description: 'Pas de grignotage sucré en dehors des repas.',
  },
  { type: 'desserts', title: 'Réduire les desserts sucrés', description: 'Moins de desserts, ou des portions plus petites.' },
  { type: 'drinks', title: 'Réduire les boissons sucrées', description: 'Sodas, jus, boissons énergisantes…' },
  { type: 'custom', title: 'Définir mon propre objectif', description: 'Écris-le avec tes mots.' },
];

export const CUSTOM_GOAL_MAX_LENGTH = 80;

export interface Goal {
  id: number;
  type: GoalType;
  customLabel: string | null;
  effectiveFrom: DateKey;
}

export function goalLabel(goal: Pick<Goal, 'type' | 'customLabel'>): string {
  if (goal.type === 'custom') return goal.customLabel?.trim() || 'Mon objectif personnel';
  return GOAL_OPTIONS.find((option) => option.type === goal.type)?.title ?? '';
}

/** Objectif en vigueur à une date (le plus récent dont la date d'effet est passée). */
export function goalForDate<T extends Pick<Goal, 'effectiveFrom'>>(goals: readonly T[], date: DateKey): T | null {
  let result: T | null = null;
  for (const goal of goals) {
    if (goal.effectiveFrom <= date && (!result || goal.effectiveFrom >= result.effectiveFrom)) result = goal;
  }
  return result;
}

/** Objectif programmé après une date (changement prenant effet plus tard). */
export function upcomingGoal<T extends Pick<Goal, 'effectiveFrom'>>(goals: readonly T[], date: DateKey): T | null {
  let result: T | null = null;
  for (const goal of goals) {
    if (goal.effectiveFrom > date && (!result || goal.effectiveFrom < result.effectiveFrom)) result = goal;
  }
  return result;
}

export function isValidGoalType(value: string): value is GoalType {
  return GOAL_OPTIONS.some((option) => option.type === value);
}

export type CravingMoment = 'morning' | 'after-lunch' | 'afternoon' | 'evening' | 'variable';

export const CRAVING_MOMENTS: readonly { value: CravingMoment; label: string; hint: string }[] = [
  { value: 'morning', label: 'Le matin', hint: 'Petit-déjeuner, pause de 10 h' },
  { value: 'after-lunch', label: 'Après le déjeuner', hint: 'L’envie du petit dessert' },
  { value: 'afternoon', label: "L'après-midi", hint: 'Le coup de barre de 16 h' },
  { value: 'evening', label: 'Le soir', hint: 'Devant un écran, après le dîner' },
  { value: 'variable', label: 'Ça varie', hint: 'Pas de moment précis' },
];

export function isValidCravingMoment(value: string): value is CravingMoment {
  return CRAVING_MOMENTS.some((moment) => moment.value === value);
}
