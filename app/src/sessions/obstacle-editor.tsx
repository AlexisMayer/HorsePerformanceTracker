import {
  estCombinaison,
  TYPES_OBSTACLE,
  TYPES_OBSTACLE_SIMPLE,
  type TypeObstacle,
  type TypeObstacleSimple,
} from '@hpt/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Button, Card, Text } from '../ui';
import { ChipGroup } from './chips';
import { DifficultyMarker } from './difficulty-marker';
import { clampCounter, type ObstacleDraft, obstaclePreviewRate, resizeÉléments } from './draft';
import { HeightBar } from './height-bar';
import { RatePreview } from './rate-preview';
import { TapCounter } from './tap-counter';

export interface ObstacleEditorProps {
  obstacle: ObstacleDraft;
  index: number;
  onChange: (patch: Partial<ObstacleDraft>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const OBSTACLE_TYPE_OPTIONS = TYPES_OBSTACLE.map((t) => ({ value: t, label: t }));
const ÉLÉMENT_TYPE_OPTIONS = TYPES_OBSTACLE_SIMPLE.map((t) => ({ value: t, label: t }));

/**
 * Éditeur d'un **obstacle** (entraînement) — chip de type → hauteur → compteurs
 * `rép/barres/refus`, avec **aperçu du taux** en direct (UI/UX §6.3, Spec §3.2).
 * Le type **Combinaison** ouvre le `nombre d'éléments` (dénominateur = rép ×
 * éléments, §7) et, **au choix**, le détail des types saisi à la main — la
 * **sélection depuis une bibliothèque réutilisable est le lot 2.5**. Les fautes
 * restent **au niveau de la combinaison**.
 */
export function ObstacleEditor({
  obstacle,
  index,
  onChange,
  onDuplicate,
  onRemove,
}: ObstacleEditorProps) {
  const combinaison = estCombinaison(obstacle.type);
  const [showDetail, setShowDetail] = useState(obstacle.éléments.length > 0);

  const denom = combinaison
    ? obstacle.répétitions * obstacle.nombre_d_éléments
    : obstacle.répétitions;
  const basis = `sur ${denom} effort${denom > 1 ? 's' : ''}`;

  const setType = (type: TypeObstacle) => {
    // Quitter une combinaison referme et oublie le détail des éléments.
    if (!estCombinaison(type)) {
      setShowDetail(false);
      onChange({ type, éléments: [] });
    } else {
      onChange({ type });
    }
  };

  const setNombreÉléments = (raw: number) => {
    const nombre_d_éléments = clampCounter(raw, 2);
    onChange({
      nombre_d_éléments,
      éléments: showDetail
        ? resizeÉléments(obstacle.éléments, nombre_d_éléments)
        : obstacle.éléments,
    });
  };

  const toggleDetail = () => {
    if (showDetail) {
      setShowDetail(false);
      onChange({ éléments: [] });
    } else {
      setShowDetail(true);
      onChange({ éléments: resizeÉléments(obstacle.éléments, obstacle.nombre_d_éléments) });
    }
  };

  const setÉlément = (slot: number, type: TypeObstacleSimple) => {
    const éléments = [...obstacle.éléments];
    éléments[slot] = type;
    onChange({ éléments });
  };

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="h2">Obstacle {index + 1}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Supprimer l'obstacle ${index + 1}`}
          onPress={onRemove}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        >
          <Text variant="bodyStrong" color="danger">
            ✕
          </Text>
        </Pressable>
      </View>

      <ChipGroup
        label="Type"
        options={OBSTACLE_TYPE_OPTIONS}
        value={obstacle.type}
        onChange={setType}
      />

      <HeightBar value={obstacle.hauteur} onChange={(hauteur) => onChange({ hauteur })} />

      <View style={styles.counters}>
        <TapCounter
          label="Répétitions"
          value={obstacle.répétitions}
          min={1}
          onChange={(répétitions) => onChange({ répétitions: clampCounter(répétitions, 1) })}
        />
        <TapCounter
          label="Barres"
          value={obstacle.barres}
          tone="danger"
          onChange={(barres) => onChange({ barres: clampCounter(barres, 0) })}
        />
        <TapCounter
          label="Refus"
          value={obstacle.refus}
          tone="danger"
          onChange={(refus) => onChange({ refus: clampCounter(refus, 0) })}
        />
      </View>

      {combinaison ? (
        <View style={styles.combination}>
          <View style={styles.combinationCounter}>
            <TapCounter
              label="Nombre d'éléments"
              value={obstacle.nombre_d_éléments}
              min={2}
              onChange={setNombreÉléments}
            />
          </View>
          <Button
            label={
              showDetail ? 'Masquer le détail des éléments' : 'Détailler les éléments (optionnel)'
            }
            variant="ghost"
            onPress={toggleDetail}
          />
          {showDetail
            ? obstacle.éléments.map((élément, slot) => (
                <ChipGroup
                  // biome-ignore lint/suspicious/noArrayIndexKey: slots ordonnés et de taille fixe
                  key={slot}
                  label={`Élément ${slot + 1}`}
                  options={ÉLÉMENT_TYPE_OPTIONS}
                  value={élément}
                  onChange={(type) => setÉlément(slot, type)}
                />
              ))
            : null}
        </View>
      ) : null}

      <DifficultyMarker
        value={obstacle.difficulté}
        onChange={(difficulté) => onChange({ difficulté })}
      />

      <RatePreview rate={obstaclePreviewRate(obstacle)} basis={basis} />

      <Button label="Même obstacle, +5 cm" variant="secondary" onPress={onDuplicate} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remove: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: {
    backgroundColor: colors.surfaceSunken,
  },
  counters: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  combination: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  combinationCounter: {
    alignItems: 'flex-start',
  },
});
