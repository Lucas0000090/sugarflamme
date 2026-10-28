/**
 * Informations publiques de l'app. Les pages légales sont publiées depuis le
 * dossier `docs/` du dépôt avec GitHub Pages (voir PUBLICATION.md).
 *
 * ⚠️ À compléter avant publication : PUBLISHER et CONTACT_EMAIL (et les mêmes
 * informations dans docs/*.html).
 */
const SITE = 'https://lucas0000090.github.io/sugarflamme';

export const LINKS = {
  privacy: `${SITE}/confidentialite.html`,
  terms: `${SITE}/conditions.html`,
  support: `${SITE}/`,
} as const;

export const PUBLISHER = '[Nom de l’éditeur à compléter]';
export const CONTACT_EMAIL = '[adresse e-mail de contact à compléter]';
