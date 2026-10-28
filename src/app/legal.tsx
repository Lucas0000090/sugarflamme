import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Text } from 'react-native';

import { Button, Card, Screen } from '@/components/ui';
import { CONTACT_EMAIL, LINKS, PUBLISHER } from '@/config';
import { typography } from '@/theme';

/** Résumé des informations légales ; la version complète est en ligne (voir LINKS). */
const DOCUMENTS = {
  privacy: {
    title: 'Confidentialité',
    link: { label: 'Politique de confidentialité complète', url: LINKS.privacy },
    sections: [
      {
        title: 'Données de suivi',
        body: 'Ton objectif, tes bilans quotidiens, tes pauses SOS (date, durée, intensités), tes jokers, tes badges et tes préférences restent uniquement sur ce téléphone, dans une base de données locale. SugarFlame ne crée pas de compte et n’utilise aucun outil publicitaire ou de mesure d’audience.',
      },
      {
        title: 'Abonnement Premium',
        body: 'Les paiements sont traités par Apple (App Store) ou Google (Google Play). Pour vérifier ton abonnement, SugarFlame utilise le service RevenueCat, qui reçoit un identifiant anonyme généré par l’app et l’historique de tes achats. Aucune donnée de suivi (bilans, envies) ne lui est transmise.',
      },
      {
        title: 'Notifications',
        body: 'Les rappels sont programmés localement par ton téléphone. Tu peux les désactiver à tout moment dans les réglages.',
      },
      {
        title: 'Suppression',
        body: 'Réglages → « Supprimer mes données » efface immédiatement toutes les données de suivi. Ton abonnement n’est pas affecté : gère-le depuis ton compte Apple ou Google.',
      },
      { title: 'Contact', body: `${PUBLISHER} — ${CONTACT_EMAIL}` },
    ],
  },
  legal: {
    title: 'Mentions légales',
    link: { label: 'Conditions d’utilisation complètes', url: LINKS.terms },
    sections: [
      { title: 'Éditeur', body: `${PUBLISHER} — ${CONTACT_EMAIL}` },
      {
        title: 'Avertissement santé',
        body: 'SugarFlame est une application de motivation et de bien-être. Ce n’est pas un dispositif médical : elle ne pose aucun diagnostic et ne remplace pas l’avis d’un professionnel de santé.',
      },
      {
        title: 'Abonnement',
        body: 'SugarFlame Premium est un abonnement à renouvellement automatique (mensuel ou annuel), géré et annulable depuis ton compte Apple ou Google.',
      },
      {
        title: 'Propriété',
        body: 'Le nom SugarFlame, les illustrations de flammes et les contenus de l’application sont originaux.',
      },
    ],
  },
} as const;

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const document = doc === 'legal' ? DOCUMENTS.legal : DOCUMENTS.privacy;
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: document.title }} />
      {document.sections.map((section) => (
        <Card key={section.title}>
          <Text style={typography.heading} accessibilityRole="header">
            {section.title}
          </Text>
          <Text style={typography.body}>{section.body}</Text>
        </Card>
      ))}
      <Button label={document.link.label} variant="secondary" onPress={() => void Linking.openURL(document.link.url)} />
    </Screen>
  );
}
