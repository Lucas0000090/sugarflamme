import { Text } from 'react-native';

import { Card, Screen } from '@/components/ui';
import { REWARD_TIERS } from '@/domain/rewards';
import {
  CORRECTION_WINDOW_DAYS,
  JOKER_EARN_EVERY,
  JOKER_MAX_BALANCE,
  JOKER_WINDOW_DAYS,
  VALIDATION_OPEN_HOUR,
} from '@/domain/rules';
import { typography } from '@/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Le bilan du soir',
    body: `Chaque jour, à partir de ${VALIDATION_OPEN_HOUR} h, tu indiques si tu as respecté ton objectif. Une journée n’est comptée qu’une seule fois.`,
  },
  {
    title: 'La série',
    body: 'Chaque journée réussie fait avancer ta série. Une journée non réussie l’interrompt. Les pauses SOS ne valident jamais une journée : seul ton bilan compte.',
  },
  {
    title: 'Les oublis et les corrections',
    body: `Une journée non renseignée reste en attente pendant ${CORRECTION_WINDOW_DAYS * 24} heures après sa fin : elle n’interrompt pas ta série tant que tu peux encore répondre. Pendant ce même délai, tu peux corriger ta réponse.`,
  },
  {
    title: 'Les jokers',
    body: `Tu gagnes un joker tous les ${JOKER_EARN_EVERY} jours réussis (au total, même s’ils ne sont pas consécutifs), avec ${JOKER_MAX_BALANCE} jokers maximum en réserve. Un joker protège une journée manquée des ${JOKER_WINDOW_DAYS} derniers jours : ta série continue, mais la journée ne compte pas comme réussie. Il ne s’utilise jamais tout seul : c’est toi qui décides. Si tu corriges ensuite cette journée en « objectif respecté », le joker t’est rendu.`,
  },
  {
    title: 'Les récompenses',
    body: `Paliers : ${REWARD_TIERS.map((tier) => `${tier.name} (${tier.days} j)`).join(', ')}. Chaque palier débloque une nouvelle flamme et un badge permanent. Ton record et tes badges restent acquis après un écart.`,
  },
  {
    title: 'Important',
    body: 'SugarFlame est un outil de motivation et de bien-être. Ce n’est pas un dispositif médical et il ne remplace pas l’avis d’un professionnel de santé. En cas de trouble alimentaire, de diabète ou de question sur ta santé, parles-en à un médecin.',
  },
];

export default function RulesScreen() {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <Text style={typography.heading} accessibilityRole="header">
            {section.title}
          </Text>
          <Text style={typography.body}>{section.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}
