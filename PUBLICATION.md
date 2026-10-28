# Publier SugarFlame (App Store et Google Play) avec l'abonnement Premium

Ce guide liste, dans l'ordre, tout ce qu'il reste à faire pour publier l'app. Le code est prêt : l'abonnement fonctionne dès que les comptes ci-dessous sont créés et que les clés sont renseignées.

> **Dépenses obligatoires** (à décider par toi, rien n'a été engagé) :
> - **Apple Developer Program : 99 € par an**, indispensable pour publier sur l'App Store.
> - **Google Play Console : 25 $ une seule fois**, pour Android.
> - **RevenueCat** (vérification des abonnements) : gratuit tant que les revenus mensuels restent sous 2 500 $ (à vérifier sur revenuecat.com/pricing).
> - **Commission des stores** : 15 % des ventes, à condition de t'inscrire au programme « Small Business » d'Apple. Chez Google, c'est 15 % sur les abonnements.

---

## Étape 0 — Informations à compléter dans le code

1. Dans `src/config.ts`, remplace `PUBLISHER` (ton nom, ou celui de ta société) et `CONTACT_EMAIL` (une adresse de contact).
2. Fais le même remplacement dans les trois pages du dossier `docs/` (`[Nom de l’éditeur à compléter]` et `[adresse e-mail de contact à compléter]`).
3. Vérifie l'identifiant `com.sugarflame.app` dans `app.json`. S'il est déjà pris sur l'App Store, choisis par exemple `com.tonnom.sugarflame`.

## Étape 1 — Mettre en ligne les pages légales (gratuit)

Apple et Google exigent une politique de confidentialité et une page d'assistance accessibles en ligne.

1. Sur GitHub, ouvre le dépôt `sugarflamme` → **Settings** → **Pages**.
2. Dans « Source », choisis **Deploy from a branch**, puis la branche `main` et le dossier **`/docs`** → **Save**.
3. Après une ou deux minutes, les pages sont en ligne :
   - Assistance : https://lucas0000090.github.io/sugarflamme/
   - Confidentialité : https://lucas0000090.github.io/sugarflamme/confidentialite.html
   - Conditions : https://lucas0000090.github.io/sugarflamme/conditions.html

## Étape 2 — Comptes développeur

- **Apple** : inscris-toi sur https://developer.apple.com/programs/ (99 €/an), en tant que particulier ou entreprise.
- Une fois inscrit, dans **App Store Connect → Accords, taxes et services bancaires** : accepte l'accord **« Apps payantes »** et renseigne ta banque et tes informations fiscales. Sans cela, les achats intégrés ne fonctionnent pas.
- Inscris-toi au **App Store Small Business Program** (commission de 15 % au lieu de 30 %) : https://developer.apple.com/app-store/small-business-program/
- **Google** (pour plus tard) : https://play.google.com/console (25 $), puis configure le profil de paiement marchand.

## Étape 3 — Créer l'app et l'abonnement dans App Store Connect

1. **Apps → + → Nouvelle app** : plateforme iOS, nom « SugarFlame », langue principale Français, identifiant de bundle `com.sugarflame.app`, SKU `sugarflame`.
2. **Monétisation → Abonnements → Créer un groupe d'abonnements** : « SugarFlame Premium ».
3. Ajoute deux abonnements dans ce groupe :

| Nom de référence | Identifiant du produit | Durée | Prix (France) |
|---|---|---|---|
| Premium mensuel | `sugarflame_premium_monthly` | 1 mois | 3,99 € |
| Premium annuel | `sugarflame_premium_yearly` | 1 an | 24,99 € |

4. Pour chacun, ajoute la localisation française :
   - Nom affiché : « SugarFlame Premium (mensuel) » ou « SugarFlame Premium (annuel) ».
   - Description : « Pauses SOS illimitées, statistiques détaillées et flamme personnalisée. »
5. Pour chacun, ajoute aussi la **capture de l'écran d'abonnement** demandée pour la vérification : `store/app-store/6-premium.png`.

## Étape 4 — RevenueCat (vérification des abonnements)

1. Crée un compte sur https://app.revenuecat.com, puis un projet « SugarFlame ».
2. **Ajoute l'app iOS** (bundle `com.sugarflame.app`) et suis l'assistant pour relier App Store Connect. Il te demandera une **clé d'achats intégrés** (fichier `.p8`), à créer dans App Store Connect → Utilisateurs et accès → Intégrations → Achats intégrés.
3. **Produits** : importe `sugarflame_premium_monthly` et `sugarflame_premium_yearly`.
4. **Entitlements** : crée un droit d'accès avec l'identifiant exact **`premium`** et rattache-lui les deux produits.
5. **Offerings** : vérifie que l'offre `default` est marquée « Current » et contient deux packages : **Monthly** → produit mensuel et **Annual** → produit annuel.
6. **API keys** : copie la clé publique iOS (elle commence par `appl_`). Plus tard, fais de même pour Android (clé en `goog_`).

## Étape 5 — Construire et envoyer l'app (EAS, offre gratuite)

Depuis le dossier du projet, sur ton ordinateur :

```bash
npm install
npx eas-cli@latest login                 # compte Expo gratuit
npx eas-cli@latest init                  # relie le projet à ton compte Expo
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_XXXX --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_XXXX --visibility plaintext
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

Lors du premier build, EAS te demande de te connecter avec ton compte Apple et crée lui-même les certificats. Ces clés RevenueCat sont publiques par conception : elles peuvent être en clair (`plaintext`).

## Étape 6 — Tester l'achat avant publication (TestFlight)

1. App Store Connect → **Utilisateurs et accès → Sandbox** : crée un testeur « sandbox » avec une adresse e-mail non utilisée.
2. App Store Connect → **TestFlight** : installe le build sur ton iPhone.
3. Dans l'app : Réglages → **Découvrir Premium** → S'abonner. Connecte-toi avec le compte sandbox quand on te le demande : rien n'est réellement débité, et en sandbox un mois dure quelques minutes.
4. Vérifie que :
   - les fonctions Premium se débloquent (SOS illimité, statistiques détaillées dans Progression, choix de la flamme dans Récompenses) ;
   - « Restaurer mes achats » fonctionne après une réinstallation ;
   - l'abonnement apparaît bien dans RevenueCat → Customers.

## Étape 7 — Fiche App Store (textes prêts à coller)

**Nom** (30 caractères max) : `SugarFlame`

**Sous-titre** (30 max) : `Moins de sucre, chaque jour`

**Texte promotionnel** (170 max) :
> Une envie de sucre ? Lance une pause guidée de 90 secondes, fais ton bilan chaque soir et regarde ta flamme grandir jour après jour.

**Mots-clés** (100 max, séparés par des virgules) :
> sucre,envie,grignotage,habitude,sans sucre,dessert,soda,motivation,défi,série,bien-être,régime

**Description** :
> Réduis tes envies de sucre, un jour à la fois.
>
> SugarFlame t'aide à tenir l'objectif que tu choisis : éviter les sucreries entre les repas, réduire les desserts, réduire les boissons sucrées, ou un objectif rien qu'à toi.
>
> UNE PAUSE QUAND L'ENVIE ARRIVE
> Appuie sur « J'ai envie de sucre » : note l'intensité de ton envie, puis laisse-toi guider pendant 90 secondes de respiration. Tu peux faire une pause, prolonger ou arrêter quand tu veux. À la fin, tu vois comment ton envie a évolué.
>
> UN BILAN CHAQUE SOIR
> Un rappel à l'heure de ton choix te demande si tu as respecté ton objectif. Une seule réponse suffit. Tu peux corriger pendant 48 heures.
>
> UNE FLAMME QUI GRANDIT AVEC TOI
> Chaque journée réussie fait avancer ta série. À 3, 7, 14, 30, 60 et 100 jours, tu débloques une nouvelle flamme et un badge qui reste à toi, même après un écart. Tous les 7 jours réussis, tu gagnes un joker pour protéger ta série lors d'une journée difficile.
>
> TES DONNÉES RESTENT CHEZ TOI
> Pas de compte, pas de publicité. Ton suivi reste sur ton téléphone.
>
> SUGARFLAME PREMIUM
> • Pauses SOS guidées illimitées
> • Statistiques détaillées : taux de réussite, jours difficiles, heures des envies
> • Choix de l'apparence de ta flamme
> Abonnement mensuel ou annuel à renouvellement automatique, résiliable à tout moment depuis ton compte Apple.
>
> SugarFlame est une application de motivation et de bien-être. Ce n'est pas un dispositif médical et elle ne remplace pas l'avis d'un professionnel de santé.
>
> Conditions d'utilisation : https://lucas0000090.github.io/sugarflamme/conditions.html
> Confidentialité : https://lucas0000090.github.io/sugarflamme/confidentialite.html

**URL d'assistance** : https://lucas0000090.github.io/sugarflamme/
**URL de la politique de confidentialité** : https://lucas0000090.github.io/sugarflamme/confidentialite.html
**Catégorie principale** : Santé et forme. **Catégorie secondaire** : Style de vie.
**Copyright** : `2026 [Nom de l'éditeur]`
**Classification par âge** : réponds « Non » à toutes les questions. Le résultat attendu est 4+.

**Captures d'écran** (iPhone 6,9″, 1320 × 2868) : les 6 fichiers du dossier `store/app-store/`, dans l'ordre des numéros.

**Confidentialité de l'app** (questionnaire « App Privacy ») :
- Données collectées : **Achats → Historique d'achats**. Utilisation : fonctionnalité de l'app. Non liées à l'identité de l'utilisateur. Non utilisées pour le pistage.
- Rien d'autre : le suivi (bilans, envies) reste sur l'appareil et n'est pas « collecté » au sens d'Apple.
- Avant de soumettre, vérifie ces réponses avec la page de RevenueCat sur les étiquettes de confidentialité d'Apple (« Apple App Privacy »).

**Notes pour l'équipe de vérification Apple** (à coller dans « Informations pour la vérification ») :
> Aucun compte n'est nécessaire. Au premier lancement, terminez l'onboarding (5 écrans). Le bouton « J'ai envie de sucre » lance la pause guidée (une par jour en version gratuite). L'abonnement se trouve dans Réglages → SugarFlame Premium → « Découvrir Premium ». Il donne accès aux pauses illimitées, aux statistiques détaillées (écran Progression) et au choix de la flamme (écran Récompenses). « Restaurer mes achats » se trouve sur le même écran. SugarFlame est une application de bien-être, sans aucune allégation médicale.

## Étape 8 — Google Play (quand tu voudras)

1. Crée l'app dans la Play Console (langue : français, application gratuite avec achats intégrés).
2. **Monétiser → Abonnements** : crée deux abonnements avec les mêmes identifiants que sur iOS (mensuel 3,99 €, annuel 24,99 €).
3. Relie Google Play à RevenueCat : il faut un compte de service Google Cloud ; l'assistant RevenueCat explique la marche à suivre.
4. Dans RevenueCat, rattache les produits Google au droit `premium` et aux packages Monthly et Annual.
5. Lance `npx eas-cli@latest build --platform android --profile production`, puis `npx eas-cli@latest submit --platform android --latest`.
6. Fiche Google Play : reprends les textes ci-dessus. Le titre est limité à 30 caractères et la description courte à 80, par exemple : « Réduis tes envies de sucre avec une pause guidée et une flamme qui grandit. »
   - Visuels : les 6 captures et `banniere-1024x500.png` du dossier `store/google-play/`, plus l'icône `icone-512.png`.
7. **Sécurité des données** :
   - données collectées : « Historique des achats » et « Identifiants de l'appareil ou autres », pour la fonctionnalité de l'app, chiffrées en transit, non partagées à des fins publicitaires ;
   - aucune autre donnée n'est collectée.

---

## Ce qui est déjà prêt dans le code

- Écran d'abonnement conforme aux règles des stores : prix réels lus dans le store, durée, renouvellement automatique, liens vers les conditions et la confidentialité, bouton « Restaurer mes achats » et gestion de l'abonnement.
- Fonctions Premium réelles : pauses SOS illimitées, statistiques détaillées, choix de la flamme.
- Les droits Premium suivent l'état réel de l'abonnement (renouvellement, expiration, remboursement). Hors ligne, l'app utilise le dernier état connu, mémorisé par RevenueCat.
- Sans clé RevenueCat (ou dans Expo Go), l'écran d'abonnement indique simplement que les achats sont indisponibles.
