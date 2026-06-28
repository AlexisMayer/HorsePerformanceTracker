import { TYPES_SEANCE, type TypeSéance } from '@hpt/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import {
  ChipGroup,
  canSave,
  DifficultyMarker,
  formatDateModification,
  ObstacleEditor,
  type SessionEdit,
  sessionErrorMessage,
  TourEditor,
  useSessionEdit,
} from '../../../sessions';
import { colors, spacing } from '../../../theme';
import { BackHeader, Button, Card, EmptyState, Screen, Text, TextField } from '../../../ui';

const TYPE_OPTIONS = TYPES_SEANCE.map((t) => ({ value: t, label: t }));

/**
 * Écran d'**édition / suppression d'une séance** (lot 2.4, Spec §3.7) — câblé sur
 * `PATCH /sessions/:id` et `DELETE /sessions/:id`. Réutilise **tels quels** les
 * composants de saisie de 2.3 (chips de type, slider de hauteur, compteurs « tap »,
 * éditeurs d'obstacle/tour, marqueur de ressenti), pré-remplis depuis la séance.
 *
 * **Honnêteté d'interface (UI/UX §7)** : l'édition n'est jamais silencieuse — la
 * `date_modification` posée par le serveur s'affiche (« Modifié le … »), sans
 * dramatiser. La suppression demande une **confirmation explicite** (action
 * destructive : purge cascade de la séance et de ses unités).
 */
export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const edit = useSessionEdit(id);

  // La séance supprimée : on quitte l'écran (retour à l'origine).
  useEffect(() => {
    if (edit.removed) router.back();
  }, [edit.removed, router]);

  if (edit.loading) {
    return (
      <Screen contentStyle={styles.center}>
        <BackHeader title="Séance" onBack={() => router.back()} />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (edit.notFound || !edit.session) {
    return (
      <Screen contentStyle={styles.content}>
        <BackHeader title="Séance" onBack={() => router.back()} />
        <EmptyState
          icon="alert-circle-outline"
          title="Séance introuvable"
          message="Cette séance n'existe plus."
        />
        <Button label="Retour" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (edit.saved) {
    return (
      <Screen contentStyle={styles.confirm}>
        <EmptyState
          icon="checkmark-circle-outline"
          title="Modifié"
          message={
            formatDateModification(edit.result?.date_modification ?? null) ||
            'Tes modifications sont enregistrées.'
          }
        />
        <Button label="Terminé" onPress={() => router.back()} />
      </Screen>
    );
  }

  return <EditBody edit={edit} onDone={() => router.back()} />;
}

function EditBody({ edit, onDone }: { edit: SessionEdit; onDone: () => void }) {
  const { draft, dispatch, session } = edit;
  const [showContexte, setShowContexte] = useState(false);

  // Ouvre la couche contexte d'emblée si la séance en portait déjà une.
  useEffect(() => {
    const c = session?.contexte;
    if (c && (c.ressenti_global != null || c.énergie != null || c.note)) setShowContexte(true);
  }, [session]);

  const isConcours = draft.type === 'Concours';
  const isPlat = draft.type === 'Plat';
  const modifiéLe = formatDateModification(session?.date_modification ?? null);

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer cette séance ?',
      'La séance et tout son détail seront définitivement supprimés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => edit.remove() },
      ],
    );
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackHeader title="Modifier la séance" onBack={onDone} />
      {modifiéLe ? (
        <Text variant="caption" color="textMuted">
          {modifiéLe}
        </Text>
      ) : null}

      <ChipGroup
        label="Type de séance"
        options={TYPE_OPTIONS}
        value={draft.type}
        onChange={(type: TypeSéance) => dispatch({ kind: 'setType', type })}
      />

      {isConcours ? (
        <View style={styles.list}>
          <Text variant="h2">Tours</Text>
          {draft.tours.map((tour, index) => (
            <TourEditor
              key={tour.localId}
              tour={tour}
              index={index}
              onChange={(patch) => dispatch({ kind: 'updateTour', localId: tour.localId, patch })}
              onRemove={() => dispatch({ kind: 'removeTour', localId: tour.localId })}
            />
          ))}
          <Button label="+ Ajouter un tour" onPress={() => dispatch({ kind: 'addTour' })} />
        </View>
      ) : isPlat ? (
        <Card>
          <Text variant="h2">Séance de plat</Text>
          <Text variant="body" color="textMuted">
            Pas d'obstacle à saisir : un plat nourrit la régularité.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          <Text variant="h2">Obstacles</Text>
          {draft.obstacles.map((obstacle, index) => (
            <ObstacleEditor
              key={obstacle.localId}
              obstacle={obstacle}
              index={index}
              onChange={(patch) =>
                dispatch({ kind: 'updateObstacle', localId: obstacle.localId, patch })
              }
              onDuplicate={() => dispatch({ kind: 'duplicateObstacle', localId: obstacle.localId })}
              onRemove={() => dispatch({ kind: 'removeObstacle', localId: obstacle.localId })}
            />
          ))}
          <Button label="+ Ajouter un obstacle" onPress={() => dispatch({ kind: 'addObstacle' })} />
        </View>
      )}

      {showContexte ? (
        <Card>
          <DifficultyMarker
            label="Ressenti global (optionnel)"
            value={draft.contexte.ressenti_global}
            onChange={(ressenti_global) =>
              dispatch({ kind: 'updateContexte', patch: { ressenti_global } })
            }
          />
          <DifficultyMarker
            label="Énergie du cheval (optionnel)"
            value={draft.contexte.énergie}
            onChange={(énergie) => dispatch({ kind: 'updateContexte', patch: { énergie } })}
          />
          <TextField
            label="Note (optionnel)"
            value={draft.contexte.note}
            onChangeText={(note) => dispatch({ kind: 'updateContexte', patch: { note } })}
            placeholder="Un mot sur la séance…"
            multiline
            maxLength={2000}
          />
        </Card>
      ) : (
        <Button
          label="Ajouter un ressenti (optionnel)"
          variant="ghost"
          onPress={() => setShowContexte(true)}
        />
      )}

      {edit.error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {sessionErrorMessage(edit.error)}
        </Text>
      ) : null}

      <View style={styles.saveBar}>
        <Button
          label="Enregistrer les modifications"
          loadingLabel="Enregistrement…"
          loading={edit.saving}
          disabled={!canSave(draft)}
          onPress={edit.save}
        />
      </View>

      <View style={styles.danger}>
        <Button
          variant="danger"
          label="Supprimer cette séance"
          loadingLabel="Suppression…"
          loading={edit.removing}
          onPress={confirmDelete}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  center: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  confirm: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  saveBar: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  danger: {
    marginTop: spacing.lg,
  },
});
