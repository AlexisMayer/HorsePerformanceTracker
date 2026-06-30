import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';
import { Badge, Text } from '../ui';
import type { OnboardingPath } from './onboarding-flow';

export interface BifurcationStepProps {
  /** Chemin pré-orienté par le `type` de compte (déjà choisi à l'inscription). */
  recommended: OnboardingPath;
  onChoose: (path: OnboardingPath) => void;
}

interface Choice {
  path: OnboardingPath;
  titre: string;
  sous_titre: string;
}

const CHOICES: readonly Choice[] = [
  { path: 'cavalier', titre: 'Cavalier', sous_titre: 'Je monte mon ou mes chevaux.' },
  { path: 'coach', titre: 'Coach', sous_titre: 'Je travaille des chevaux pour des clients.' },
];

/**
 * **Bifurcation initiale** (Spec §2.1, UI/UX §6.1) — la première question :
 * « Tu montes tes chevaux, ou tu coaches des clients ? ». Deux grandes cibles
 * (≥ 44 px, §8) qui orientent la suite : **Cavalier** (chemin court) ou **Coach**
 * (config + aperçu de bilan). Le chemin pré-orienté par le compte porte un
 * discret « Recommandé » — sans verrouiller le choix.
 */
export function BifurcationStep({ recommended, onChoose }: BifurcationStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="label" color="secondary">
          HPT
        </Text>
        <Text variant="h1">Bienvenue</Text>
        <Text variant="body" color="textMuted">
          Tu montes tes chevaux, ou tu coaches des clients ? On adapte la suite.
        </Text>
      </View>

      <View style={styles.choices}>
        {CHOICES.map((choice) => (
          <Pressable
            key={choice.path}
            accessibilityRole="button"
            accessibilityLabel={`${choice.titre} — ${choice.sous_titre}`}
            onPress={() => onChoose(choice.path)}
            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
          >
            <View style={styles.choiceHead}>
              <Text variant="h2">{choice.titre}</Text>
              {choice.path === recommended ? <Badge label="Recommandé" tone="neutral" /> : null}
            </View>
            <Text variant="body" color="textMuted">
              {choice.sous_titre}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  choices: {
    gap: spacing.md,
  },
  choice: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  choicePressed: {
    backgroundColor: colors.surfaceSunken,
  },
  choiceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
