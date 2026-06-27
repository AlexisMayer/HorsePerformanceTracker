import type { ChevalCréerDto } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { HorseForm, type HorseFormSubmit, horseErrorMessage, useHorses } from '../../horses';
import { spacing } from '../../theme';
import { BackHeader, Screen, Text } from '../../ui';

/**
 * Écran de **création de cheval** (Spec §9.2 / §2.2) — formulaire minimal câblé
 * sur `POST /horses` (lot 2.1). Au succès, retour à la liste. C'est l'écran que
 * l'onboarding guidé (3.5) réutilisera ; on ne construit pas le tunnel ici.
 */
export default function NewHorseScreen() {
  const { create } = useHorses();
  const router = useRouter();

  const handleSubmit = (values: HorseFormSubmit) => {
    // Création : les champs facultatifs vides sont **omis** (le DTO d'entrée
    // n'accepte pas `null` à la création — il devient nullable à l'édition).
    const dto: ChevalCréerDto = {
      nom: values.nom,
      niveau: values.niveau,
      hauteur_de_référence: values.hauteur_de_référence,
      ...(values.âge !== null ? { âge: values.âge } : {}),
      ...(values.race !== null ? { race: values.race } : {}),
    };
    create.mutate(dto, { onSuccess: () => router.back() });
  };

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <BackHeader title="Nouveau cheval" onBack={() => router.back()} />
      <Text variant="body" color="textMuted">
        Le minimum pour commencer. Tu pourras compléter sa fiche plus tard.
      </Text>
      <HorseForm
        submitLabel="Ajouter le cheval"
        submitLoadingLabel="Ajout…"
        loading={create.isPending}
        error={create.error ? horseErrorMessage(create.error) : undefined}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
});
