import { TYPES_SEANCE, type TypeSéance } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useHorses } from '../horses';
import {
  ChipGroup,
  canSave,
  DifficultyMarker,
  ObstacleEditor,
  sessionErrorMessage,
  TourEditor,
  useSessionCapture,
} from '../sessions';
import { colors, spacing } from '../theme';
import { BackHeader, Button, Card, EmptyState, Screen, Text, TextField } from '../ui';

const TYPE_OPTIONS = TYPES_SEANCE.map((t) => ({ value: t, label: t }));

/**
 * Écran de **saisie rapide d'une séance** (UI/UX §6.3, Spec §3) — déclenché par
 * le **FAB central** (désormais actif). Le **type de séance pilote la
 * structure** : obstacles (entraînement) ou tours (concours) ; un **Plat** ne
 * prend aucun obstacle (régularité). Duplication de la séance précédente et « +5
 * cm », aperçu des taux à la saisie, enregistrement résilient (idempotence +
 * brouillon/réessai). La proposition de **carte partageable est le lot 3.3** ;
 * ici, simple confirmation « Enregistré ».
 */
export default function CaptureScreen() {
  const { currentHorse } = useHorses();
  const router = useRouter();

  if (!currentHorse) {
    return (
      <Screen contentStyle={styles.empty}>
        <BackHeader title="Nouvelle séance" onBack={() => router.back()} />
        <EmptyState
          icon="paw-outline"
          title="Ajoute d'abord un cheval"
          message="La saisie d'une séance se fait sur un cheval. Crée sa fiche pour commencer."
        />
        <Button label="Ajouter un cheval" onPress={() => router.replace('/horses/new')} />
      </Screen>
    );
  }

  return <CaptureBody chevalId={currentHorse.id} horseName={currentHorse.nom} />;
}

function CaptureBody({ chevalId, horseName }: { chevalId: string; horseName: string }) {
  const router = useRouter();
  const capture = useSessionCapture(chevalId);
  const { draft, dispatch } = capture;
  const [showContexte, setShowContexte] = useState(false);

  if (capture.saved) {
    return (
      <Screen contentStyle={styles.confirm}>
        <EmptyState
          icon="checkmark-circle-outline"
          title="Enregistré"
          message={`La séance de ${horseName} est enregistrée.`}
        />
        <Button label="Terminé" onPress={() => router.back()} />
      </Screen>
    );
  }

  const isConcours = draft.type === 'Concours';
  const isPlat = draft.type === 'Plat';
  const lastObstacleId = draft.obstacles.at(-1)?.localId;

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackHeader title="Nouvelle séance" onBack={() => router.back()} />
      <Text variant="body" color="textMuted">
        {horseName}
      </Text>

      <ChipGroup
        label="Type de séance"
        options={TYPE_OPTIONS}
        value={draft.type}
        onChange={(type: TypeSéance) => dispatch({ kind: 'setType', type })}
      />

      {capture.hasPrevious ? (
        <Button
          label="Reprendre la séance précédente"
          variant="secondary"
          onPress={capture.prefillFromPrevious}
        />
      ) : null}

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
            Pas d'obstacle à saisir : un plat nourrit la régularité. Enregistre-le tel quel.
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
          {lastObstacleId ? (
            <Button
              label="Même obstacle, +5 cm"
              variant="secondary"
              onPress={() => dispatch({ kind: 'duplicateObstacle', localId: lastObstacleId })}
            />
          ) : null}
        </View>
      )}

      {/* Couche contexte : optionnelle, hors du chemin critique (Spec §3.6). */}
      {showContexte ? (
        <Card>
          <DifficultyMarker
            label="Ressenti global (optionnel)"
            value={draft.contexte.ressenti_global}
            onChange={(ressenti_global) =>
              dispatch({
                kind: 'updateContexte',
                patch: { ressenti_global },
              })
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

      {capture.retrying ? (
        <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          Réseau instable — réessai en cours, ta saisie est gardée…
        </Text>
      ) : null}
      {capture.error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {sessionErrorMessage(capture.error)}
        </Text>
      ) : null}

      <View style={styles.saveBar}>
        <Button
          label="Enregistrer"
          loadingLabel="Enregistrement…"
          loading={capture.saving}
          disabled={!canSave(draft)}
          onPress={capture.save}
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
  empty: {
    flex: 1,
    gap: spacing.lg,
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
});
