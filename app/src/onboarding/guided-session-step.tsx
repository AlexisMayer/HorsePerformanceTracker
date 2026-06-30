import { TYPES_SEANCE, type TypeSéance } from '@hpt/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { Button, Card, Text, TextField } from '../ui';

const TYPE_OPTIONS = TYPES_SEANCE.map((t) => ({ value: t, label: t }));

export interface GuidedSessionStepProps {
  chevalId: string;
  horseName: string;
  /** Atterrissage : la séance est enregistrée (ou ignorée) → on rejoint le feed. */
  onComplete: () => void;
}

/**
 * **Première séance guidée** (Spec §2.2 étape 3) — une **variante plus
 * explicative** de la saisie rapide (2.3) : mêmes briques (`useSessionCapture`,
 * chips de type, éditeurs d'obstacle/tour, garde `canSave`, enregistrement
 * résilient) mais avec des **explications pas-à-pas** et **sans** la duplication
 * de séance précédente (il n'y en a pas — on ne propose pas de reprendre la ligne
 * de départ déclarative). La séance créée est **`live` et duplicable** : la boucle
 * nominale (2.3/3.x) la reprendra.
 *
 * À l'enregistrement, on **atterrit directement sur le feed** (la récompense déjà
 * vue, Spec §2) — pas la proposition de carte de 3.3 (réservée à la boucle
 * nominale). « Plus tard » mène aussi au feed : la **ligne de départ** y figure
 * déjà comme repère, donc on ne sort jamais les mains vides.
 */
export function GuidedSessionStep({ chevalId, horseName, onComplete }: GuidedSessionStepProps) {
  const capture = useSessionCapture(chevalId);
  const { draft, dispatch } = capture;
  const [showContexte, setShowContexte] = useState(false);

  // Atterrissage sur le feed dès que la séance est enregistrée.
  useEffect(() => {
    if (capture.saved) onComplete();
  }, [capture.saved, onComplete]);

  const isConcours = draft.type === 'Concours';
  const isPlat = draft.type === 'Plat';
  const lastObstacleId = draft.obstacles.at(-1)?.localId;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="h1">Ta première séance</Text>
        <Text variant="body" color="textMuted">
          Logue ce que {horseName} vient de travailler. Trois gestes : choisis le type, ajoute tes
          obstacles, enregistre. Tu pourras dupliquer cette séance la prochaine fois.
        </Text>
      </View>

      <ChipGroup
        label="1 · Type de séance"
        options={TYPE_OPTIONS}
        value={draft.type}
        onChange={(type: TypeSéance) => dispatch({ kind: 'setType', type })}
      />

      {isConcours ? (
        <View style={styles.list}>
          <Text variant="h2">2 · Tes tours</Text>
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
          <Text variant="h2">2 · Séance de plat</Text>
          <Text variant="body" color="textMuted">
            Pas d'obstacle à saisir : un plat nourrit la régularité. Enregistre-le tel quel.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          <Text variant="h2">2 · Tes obstacles</Text>
          {draft.obstacles.length === 0 ? (
            <Text variant="body" color="textMuted">
              Ajoute le premier obstacle franchi : son type, sa hauteur, le nombre de fois.
            </Text>
          ) : null}
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
              dispatch({ kind: 'updateContexte', patch: { ressenti_global } })
            }
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

      <View style={styles.actions}>
        <Button
          label="3 · Enregistrer et voir mon fil"
          loadingLabel="Enregistrement…"
          loading={capture.saving}
          disabled={!canSave(draft)}
          onPress={capture.save}
        />
        <Button label="Plus tard, voir mon fil" variant="ghost" onPress={onComplete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
