import type { ChevalModifierDto } from '@hpt/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { HorseForm, type HorseFormSubmit, horseErrorMessage, useHorses } from '../../horses';
import { colors, spacing } from '../../theme';
import { BackHeader, Button, Card, Screen, Text } from '../../ui';

/**
 * Écran d'**édition de cheval** + **suppression** (Spec §9.2) — câblé sur
 * `PATCH /horses/:id` et `DELETE /horses/:id` (lot 2.1). La suppression demande
 * une **confirmation explicite** (action destructive : purge cascade de
 * l'historique) — qualité de plancher. Au succès, retour à la liste.
 */
export default function EditHorseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, isLoading, update, remove } = useHorses();
  const router = useRouter();

  const horse = horses.find((h) => h.id === id);

  if (!horse) {
    return (
      <Screen edges={['top', 'left', 'right']} contentStyle={styles.content}>
        <BackHeader title="Cheval" onBack={() => router.back()} />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Card>
            <Text variant="bodyStrong">Cheval introuvable</Text>
            <Text variant="body" color="textMuted">
              Ce cheval n'existe plus.
            </Text>
            <Button variant="secondary" label="Retour" onPress={() => router.back()} />
          </Card>
        )}
      </Screen>
    );
  }

  const handleSubmit = (values: HorseFormSubmit) => {
    // Édition : `null` efface un champ facultatif (sémantique du DTO de mise à jour).
    const dto: ChevalModifierDto = {
      nom: values.nom,
      niveau: values.niveau,
      hauteur_de_référence: values.hauteur_de_référence,
      âge: values.âge,
      race: values.race,
    };
    update.mutate({ id: horse.id, dto }, { onSuccess: () => router.back() });
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer ce cheval ?',
      `« ${horse.nom} » et tout son historique de séances seront définitivement supprimés. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => remove.mutate(horse.id, { onSuccess: () => router.back() }),
        },
      ],
    );
  };

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <BackHeader title="Modifier le cheval" onBack={() => router.back()} />

      <HorseForm
        initial={{
          nom: horse.nom,
          niveau: horse.niveau,
          hauteur_de_référence: horse.hauteur_de_référence,
          âge: horse.âge,
          race: horse.race,
        }}
        submitLabel="Enregistrer"
        submitLoadingLabel="Enregistrement…"
        loading={update.isPending}
        error={update.error ? horseErrorMessage(update.error) : undefined}
        onSubmit={handleSubmit}
      />

      <View style={styles.danger}>
        <Button
          variant="danger"
          label="Supprimer ce cheval"
          loadingLabel="Suppression…"
          loading={remove.isPending}
          onPress={confirmDelete}
        />
        {remove.error ? (
          <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
            {horseErrorMessage(remove.error)}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  center: {
    paddingVertical: spacing.xl,
  },
  danger: {
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
