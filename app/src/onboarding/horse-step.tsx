import type { ChevalCréerDto, ChevalSortie } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { HorseForm, type HorseFormSubmit, horseErrorMessage, useHorses } from '../horses';
import { spacing } from '../theme';
import { Text } from '../ui';

export interface HorseStepProps {
  /** Cavalier vs coach : adapte la voix (« ton cheval » / « le cheval de ton client »). */
  path: 'cavalier' | 'coach';
  /** Appelé avec le cheval créé (2.1) — le tunnel avance vers la ligne de départ. */
  onCreated: (horse: ChevalSortie) => void;
}

/**
 * **Création du premier cheval, minimale** (Spec §2.2, étape 1) — réutilise
 * **tel quel** le `HorseForm` et le module `horses` (2.1) : nom + niveau +
 * hauteur de référence ; âge/race **différés** (facultatifs). Aucun champ
 * superflu (Spec §2). Au succès, on remonte le cheval créé pour enchaîner sur la
 * ligne de départ — pas de nouvelle logique de domaine ici.
 */
export function HorseStep({ path, onCreated }: HorseStepProps) {
  const { create } = useHorses();

  const handleSubmit = (values: HorseFormSubmit) => {
    // Création : les champs facultatifs vides sont **omis** (cohérent avec
    // `horses/new` — le DTO de création n'accepte pas `null`, seulement l'édition).
    const dto: ChevalCréerDto = {
      nom: values.nom,
      niveau: values.niveau,
      hauteur_de_référence: values.hauteur_de_référence,
      ...(values.âge !== null ? { âge: values.âge } : {}),
      ...(values.race !== null ? { race: values.race } : {}),
    };
    create.mutate(dto, { onSuccess: onCreated });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="h1">{path === 'coach' ? 'Le premier cheval' : 'Ton cheval'}</Text>
        <Text variant="body" color="textMuted">
          {path === 'coach'
            ? 'Crée la fiche d’un cheval client. Le minimum pour commencer ; tu compléteras plus tard.'
            : 'Le minimum pour commencer. Tu pourras compléter sa fiche plus tard.'}
        </Text>
      </View>
      <HorseForm
        submitLabel="Continuer"
        submitLoadingLabel="Création…"
        loading={create.isPending}
        error={create.error ? horseErrorMessage(create.error) : undefined}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
});
