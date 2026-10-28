/** Fonctions pures liées aux sessions SOS. */

export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 10;

export function isValidIntensity(value: number): boolean {
  return Number.isInteger(value) && value >= INTENSITY_MIN && value <= INTENSITY_MAX;
}

/**
 * Message de bilan, sans culpabiliser et sans promettre que l'envie disparaît.
 */
export function intensityFeedback(before: number, after: number): { title: string; message: string } {
  const delta = before - after;
  if (delta >= 3) {
    return {
      title: `L'intensité est passée de ${before} à ${after}`,
      message: 'Belle baisse. Tu as laissé passer la vague au lieu de la suivre. Garde ce souvenir pour la prochaine fois.',
    };
  }
  if (delta > 0) {
    return {
      title: `L'intensité est passée de ${before} à ${after}`,
      message: "Un petit pas compte. L'envie est un peu moins forte qu'au début : tu as repris la main sur ce moment.",
    };
  }
  if (delta === 0) {
    return {
      title: `L'intensité est restée à ${after}`,
      message:
        "C'est normal : certaines envies prennent plus de temps. Tu peux prolonger la pause, boire un verre d'eau ou changer de pièce quelques minutes.",
    };
  }
  return {
    title: `L'intensité est passée de ${before} à ${after}`,
    message:
      "Parfois l'envie monte avant de redescendre. Tu n'as rien raté : prendre ce temps, c'est déjà agir. Quoi que tu décides, sois bienveillant avec toi-même.",
  };
}

/** Moyennes des intensités déclarées. */
export function averageIntensities(sessions: readonly { intensityBefore: number; intensityAfter: number | null }[]) {
  const completed = sessions.filter((session) => session.intensityAfter !== null);
  if (completed.length === 0) return null;
  const before = completed.reduce((sum, session) => sum + session.intensityBefore, 0) / completed.length;
  const after = completed.reduce((sum, session) => sum + (session.intensityAfter ?? 0), 0) / completed.length;
  return { before, after, count: completed.length };
}
