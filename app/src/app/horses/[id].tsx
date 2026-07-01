import type { ChevalModifierDto, ChevalSortie } from '@hpt/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GuestInvitesSection } from '../../guest-access';
import {
  HorseForm,
  type HorseFormSubmit,
  horseErrorMessage,
  isQuotaBlocked,
  useHorses,
} from '../../horses';
import { colors, spacing } from '../../theme';
import { BackHeader, Badge, Button, Card, Screen, Text } from '../../ui';

const NIVEAU_LABELS: Record<ChevalSortie['niveau'], string> = {
  amateur: 'Amateur',
  pro: 'Pro',
};

/**
 * Écran d'**édition de cheval** + **archivage** + **suppression** (Spec §9.2) —
 * câblé sur `PATCH /horses/:id`, `POST /horses/:id/archive|unarchive` et
 * `DELETE /horses/:id`. La suppression demande une **confirmation explicite**
 * (purge cascade de l'historique). Au succès, retour à la liste.
 *
 * **Archivage (lot 4.3)** : un cheval **actif** peut être **archivé** (bouton
 * dédié, confirmation). Un cheval **archivé** bascule en **lecture seule** — la
 * fiche s'affiche figée, sans formulaire éditable ; on peut le **désarchiver**
 * (refus **quota** → invitation à passer Pro, UI/UX §7) ou le supprimer.
 */
export default function EditHorseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, isLoading, update, remove, archive, unarchive } = useHorses();
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

  const deleteButton = (
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
  );

  // Cheval **archivé** : lecture seule (Spec §9.2) — pas de formulaire éditable.
  if (horse.archivé) {
    const quotaBloqué = isQuotaBlocked(unarchive.error);
    return (
      <Screen scroll edges={['top', 'left', 'right']} contentStyle={styles.content}>
        <BackHeader title="Cheval archivé" onBack={() => router.back()} />

        <Card>
          <View style={styles.row}>
            <Text variant="h2" numberOfLines={1} style={styles.name}>
              {horse.nom}
            </Text>
            <Badge label="Archivé" tone="neutral" />
          </View>
          <Text variant="body" color="textMuted">
            Niveau : {NIVEAU_LABELS[horse.niveau]} · Hauteur de référence :{' '}
            {horse.hauteur_de_référence} cm
            {horse.âge != null ? ` · ${horse.âge} ans` : ''}
            {horse.race ? ` · ${horse.race}` : ''}
          </Text>
          <Text variant="body" color="textMuted">
            Ce cheval est en lecture seule : son historique est conservé, mais il ne compte plus
            dans ton quota et n'apparaît plus dans le sélecteur.
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            label="Désarchiver"
            loadingLabel="Désarchivage…"
            loading={unarchive.isPending}
            onPress={() => unarchive.mutate(horse.id, { onSuccess: () => router.back() })}
          />
          {unarchive.error ? (
            <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
              {horseErrorMessage(unarchive.error)}
            </Text>
          ) : null}
          {quotaBloqué ? (
            <Button
              variant="secondary"
              label="Passer au Pro"
              onPress={() =>
                router.push({ pathname: '/upgrade', params: { cap: 'multi_chevaux' } })
              }
            />
          ) : null}
        </View>

        {deleteButton}
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

  const confirmArchive = () => {
    Alert.alert(
      'Archiver ce cheval ?',
      `« ${horse.nom} » passera en lecture seule : son historique est conservé, il sort de la liste active et ne compte plus dans ton quota. Tu pourras le désarchiver plus tard.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          onPress: () => archive.mutate(horse.id, { onSuccess: () => router.back() }),
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

      {/* Comptes invité (lot 4.6) — partager ce cheval avec un client en lecture
          seule (Pro ; grisé + invitation à l'upgrade sinon). Le serveur enforce. */}
      <GuestInvitesSection chevalId={horse.id} />

      <View style={styles.actions}>
        <Button
          variant="secondary"
          label="Archiver ce cheval"
          loadingLabel="Archivage…"
          loading={archive.isPending}
          onPress={confirmArchive}
        />
        {archive.error ? (
          <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
            {horseErrorMessage(archive.error)}
          </Text>
        ) : null}
      </View>

      {deleteButton}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  danger: {
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
