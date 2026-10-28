/** Règles produit centralisées : un seul endroit à modifier. */

/** Une journée reste modifiable (et « en attente » si vide) jusqu'à 48 h après sa fin. */
export const CORRECTION_WINDOW_DAYS = 2;

/** La validation du jour en cours s'ouvre à partir de cette heure locale. */
export const VALIDATION_OPEN_HOUR = 18;

/** Un joker est gagné tous les N jours réussis (cumulés). */
export const JOKER_EARN_EVERY = 7;

/** Nombre maximum de jokers disponibles en même temps. */
export const JOKER_MAX_BALANCE = 2;

/** Un joker ne peut protéger qu'une journée datant de moins de N jours. */
export const JOKER_WINDOW_DAYS = 7;

/** Plage autorisée pour l'heure du rappel quotidien. */
export const REMINDER_MIN_HOUR = 18;
export const REMINDER_MAX_HOUR = 23;
export const DEFAULT_REMINDER_HOUR = 21;

/** Durée de la pause guidée SOS et de chaque prolongation. */
export const SOS_PAUSE_SECONDS = 90;
export const SOS_EXTENSION_SECONDS = 30;
