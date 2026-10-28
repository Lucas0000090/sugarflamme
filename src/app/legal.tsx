import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { Card, Screen } from '@/components/ui';
import { colors, typography } from '@/theme';

/**
 * Emplacements des informations légales.
 * Les passages marqués « À compléter » doivent être remplis avant publication
 * sur les stores (éditeur, contact, hébergement de la politique en ligne…).
 */
const DOCUMENTS = {
  privacy: {
    title: 'Confidentialité',
    sections: [
      {
        title: 'Données stockées',
        body: 'Ton objectif, tes bilans quotidiens, tes pauses SOS (date, durée, intensités), tes jokers, tes badges et tes préférences de rappel.',
      },
      {
        title: 'Où sont-elles ?',
        body: 'Uniquement sur ce téléphone, dans une base de données locale. SugarFlame ne crée pas de compte, n’envoie aucune donnée à un serveur et n’utilise aucun outil publicitaire ou de mesure d’audience.',
      },
      {
        title: 'Notifications',
        body: 'Les rappels sont programmés localement par ton téléphone. Tu peux les désactiver à tout moment dans les réglages.',
      },
      {
        title: 'Suppression',
        body: 'Réglages → « Supprimer mes données » efface tout immédiatement. Désinstaller l’application supprime aussi ces données.',
      },
      {
        title: 'Contact',
        body: 'À compléter avant publication : adresse de contact pour les questions de confidentialité et lien vers la politique en ligne.',
        todo: true,
      },
    ],
  },
  legal: {
    title: 'Mentions légales',
    sections: [
      { title: 'Éditeur', body: 'À compléter avant publication : nom ou raison sociale, adresse, contact.', todo: true },
      {
        title: 'Avertissement santé',
        body: 'SugarFlame est une application de motivation et de bien-être. Ce n’est pas un dispositif médical : elle ne pose aucun diagnostic et ne remplace pas l’avis d’un professionnel de santé.',
      },
      {
        title: 'Propriété',
        body: 'Le nom SugarFlame, les illustrations de flammes et les contenus de l’application sont originaux.',
      },
      { title: 'Conditions d’utilisation', body: 'À compléter avant publication.', todo: true },
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
        <Card key={section.title} style={'todo' in section && section.todo ? { borderWidth: 1, borderColor: colors.border } : undefined}>
          <Text style={typography.heading} accessibilityRole="header">
            {section.title}
          </Text>
          <Text style={typography.body}>{section.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}
