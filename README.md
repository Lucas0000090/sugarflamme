# SugarFlame

Application mobile iOS et Android pour gérer ses envies de sucre, réduire sa consommation selon un objectif personnel et rester motivé grâce à une série quotidienne, des jokers et une flamme qui évolue.

Projet indépendant du reste du dépôt : tout se trouve dans ce dossier `sugarflame/`.

## Stack

- Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router
- Expo SQLite (données locales, migrations versionnées)
- Expo Notifications (rappels locaux, aucune notification push)
- React Native Reanimated + react-native-svg (flamme, respiration, célébrations)
- Aucun backend, aucun compte, aucune API payante, aucun secret

## Lancer l'application sur un téléphone

Prérequis : Node.js 20 ou plus récent.

```bash
cd sugarflame
npm install
npx expo start
```

### Avec Expo Go (gratuit, le plus rapide)

1. Installe **Expo Go** depuis l'App Store ou le Play Store (version compatible SDK 58).
2. Lance `npx expo start` sur ton ordinateur (téléphone et ordinateur sur le même Wi‑Fi ; sinon `npx expo start --tunnel`).
3. **Android** : scanne le QR code depuis Expo Go. **iOS** : scanne le QR code avec l'appareil photo.

Toutes les bibliothèques utilisées sont incluses dans Expo Go. Dans Expo Go, l'icône, le nom de l'app et l'icône de notification sont ceux d'Expo Go : c'est normal.

### Avec une vraie build (icône, nom, notifications à l'identique de la version publiée)

- **Android, en local** (Android Studio installé) : `npx expo run:android`
- **iOS, en local** (Mac + Xcode) : `npx expo run:ios` — sur un iPhone physique, un compte Apple gratuit suffit pour un test de 7 jours.
- **Dans le cloud** avec EAS (offre gratuite) : `npx eas-cli@latest build --profile preview --platform android` produit un APK installable directement.

Les dossiers `ios/` et `android/` sont générés automatiquement à partir de `app.json` : ne pas les modifier à la main.

## Vérifications

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint (config Expo)
npm test            # Tests unitaires et tests de rendu (fuseau Europe/Paris)
npm run check       # Les trois à la suite
```

## Architecture

```
src/
  app/            Écrans (Expo Router) : onboarding, accueil, sos, validation,
                  celebration, progress, rewards, settings, rules, legal
  components/     Composants réutilisables : Flame, BreathingCircle,
                  IntensityPicker, TimePicker, calendrier, boutons, cartes…
  domain/         Règles métier pures et testées, sans dépendance à React Native
    dates.ts        Jours locaux « AAAA-MM-JJ », robustes aux changements d'heure
    streak.ts       Séries, jokers, statuts des journées
    validation.ts   Bilan quotidien, fenêtre de correction de 48 h
    rewards.ts      Paliers et apparences de flamme
    goals.ts        Objectifs et moments d'envie
    premium.ts      Séparation Gratuit / Premium
    rules.ts        Constantes produit (heures, délais, plafonds)
  db/             Migrations SQLite et requêtes (transactions)
  services/       Notifications locales
  state/          AppProvider : état de l'app dérivé de la base
  theme/          Couleurs, espacements, typographie
```

Principe : la base stocke uniquement l'historique (bilans, jokers utilisés, sessions SOS, badges). Série, record et jokers disponibles sont **recalculés** à partir de cet historique et de la date du jour par `src/domain/streak.ts`. Le résultat est donc déterministe et ne peut pas se désynchroniser.

### Données (SQLite)

| Table | Contenu |
|---|---|
| `schema_migrations` | Version du schéma |
| `profile` | Préférences (date de début, moment des envies, rappel) — une seule ligne |
| `goals` | Historique des objectifs (date d'effet unique) |
| `day_entries` | Bilans quotidiens (une ligne par jour, clé primaire = date) |
| `sos_sessions` | Pauses SOS (intensités avant/après, durée) |
| `joker_movements` | Jokers utilisés (une seule protection par journée) |
| `rewards` | Badges débloqués (permanents) |

## Règles des séries

- Le bilan du jour s'ouvre à 18 h. Une journée n'est comptée qu'une fois ; une nouvelle réponse devient une correction.
- Une journée non renseignée reste **en attente** jusqu'à 48 h après sa fin (elle n'interrompt pas la série). Les corrections sont possibles pendant ce même délai.
- Une journée réussie fait avancer la série, une journée non réussie (ou non renseignée après 48 h) l'interrompt. Le record et les badges restent acquis.
- Un joker est gagné tous les 7 jours réussis (cumulés), 2 au maximum. Il protège une journée manquée des 7 derniers jours, sans la compter comme réussie, et uniquement sur action explicite. S'il est utilisé sur une journée ensuite corrigée en réussite, il est rendu.
- Les pauses SOS ne valident jamais une journée.

## Notifications

Chaque soir (21 h par défaut, réglable de 18 h à 23 h 45), une notification locale demande « As-tu respecté ton objectif aujourd'hui ? ». Le rappel est programmé pour chacun des 14 prochains jours non validés : la notification connaît ainsi la journée qu'elle concerne (même si on y répond après minuit), et aucun rappel n'est envoyé pour une journée déjà validée. La liste est mise à jour à chaque ouverture de l'app.

- Toucher la notification ouvre l'écran de bilan.
- Deux actions rapides, « Oui, objectif respecté » et « Pas aujourd'hui », **ouvrent l'application**, qui enregistre la réponse puis affiche le résultat (même comportement sur iOS et Android, y compris app fermée). Aucune réponse n'est enregistrée en arrière-plan sans ouvrir l'app.
- « Plus tard » programme un rappel unique une heure après.
- Notifications refusées : l'app reste entièrement utilisable depuis l'accueil, et les réglages proposent d'ouvrir les réglages du téléphone.

## Gratuit / Premium

- **Gratuit** : série, badges, bilan du soir, une pause SOS guidée par jour, statistiques de base.
- **Premium** (abonnement App Store / Google Play, 3,99 €/mois ou 24,99 €/an) : pauses SOS illimitées, statistiques détaillées, choix de l'apparence de la flamme.

Les achats passent par RevenueCat (`src/services/purchases.ts`) avec le droit `premium`. Les clés publiques se configurent via `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (voir `.env.example`). Sans clé, ou dans Expo Go, l'écran d'abonnement indique que les achats sont indisponibles : pour tester un vrai achat, il faut un build (TestFlight).

## Publication

Tout est décrit pas à pas dans [PUBLICATION.md](PUBLICATION.md) : comptes, abonnements, RevenueCat, build EAS, fiche App Store prête à coller et captures d'écran (`store/`). Les pages légales en ligne sont dans `docs/` (GitHub Pages).
