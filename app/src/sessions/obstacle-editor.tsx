import {
  estCombinaison,
  TYPES_OBSTACLE,
  TYPES_OBSTACLE_SIMPLE,
  type TypeObstacle,
  type TypeObstacleSimple,
} from '@hpt/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCombinations } from '../combinations';
import { colors, radius, spacing } from '../theme';
import { Button, Card, Text } from '../ui';
import { ChipGroup } from './chips';
import { DifficultyMarker } from './difficulty-marker';
import {
  clampCounter,
  type ObstacleDraft,
  obstaclePreviewRate,
  obstacleToCombinaisonDto,
  resizeÉléments,
  selectReusable,
  unlinkReusable,
} from './draft';
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
 *
 * Le type **Combinaison** offre **deux voies** (Modèle §8, lot 2.5) :
 *  - **inline** : `nombre d'éléments` (dénominateur = rép × éléments, §7) +,
 *    au choix, le détail des types ; cette combinaison détaillée peut être
 *    **enregistrée comme réutilisable** (« Enregistrer cette combinaison ») ;
 *  - **instanciée** depuis la **bibliothèque** : on **sélectionne** une
 *    réutilisable (`combinaison_ref`) et on **ne saisit que la hauteur** (+
 *    rép/fautes) — la structure (`nombre_d_éléments`, `éléments`) est héritée.
 * Les fautes restent **au niveau de la combinaison**.
 */
export function ObstacleEditor({
  obstacle,
  index,
  onChange,
  onDuplicate,
  onRemove,
}: ObstacleEditorProps) {
  const combinaison = estCombinaison(obstacle.type);
  const { combinaisons, create: createCombinaison } = useCombinations();
  const [showDetail, setShowDetail] = useState(obstacle.éléments.length > 0);

  const linked = obstacle.combinaison_ref !== null;
  const linkedCombo = linked
    ? (combinaisons.find((c) => c.id === obstacle.combinaison_ref) ?? null)
    : null;
  const saveDto = obstacleToCombinaisonDto(obstacle);

  const denom = combinaison
    ? obstacle.répétitions * obstacle.nombre_d_éléments
    : obstacle.répétitions;
  const basis = `sur ${denom} effort${denom > 1 ? 's' : ''}`;

  const setType = (type: TypeObstacle) => {
    // Quitter une combinaison referme le détail, oublie les éléments et le lien.
    if (!estCombinaison(type)) {
      setShowDetail(false);
      onChange({ type, éléments: [], combinaison_ref: null });
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

  const handleSaveReusable = () => {
    if (!saveDto) return;
    // Enregistrée, puis **liée** à l'obstacle : il instancie désormais la
    // réutilisable (détail hérité ensuite, suivi possible en benchmark 5.2).
    createCombinaison.mutate(saveDto, {
      onSuccess: (created) => {
        setShowDetail(false);
        onChange({
          combinaison_ref: created.id,
          nombre_d_éléments: created.nombre_d_éléments,
          éléments: [],
        });
      },
    });
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
          {linked ? (
            // Instanciée depuis une réutilisable : « on ne saisit que la hauteur ».
            <View style={styles.linked}>
              <Text variant="bodyStrong">
                {linkedCombo ? linkedCombo.nom : 'Combinaison enregistrée'}
              </Text>
              <Text variant="caption" color="textMuted">
                {obstacle.nombre_d_éléments} éléments — hérités de ta bibliothèque
              </Text>
              <Button
                label="Détacher (saisir le détail)"
                variant="ghost"
                onPress={() => onChange(unlinkReusable())}
              />
            </View>
          ) : (
            <>
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
                  showDetail
                    ? 'Masquer le détail des éléments'
                    : 'Détailler les éléments (optionnel)'
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

              {saveDto ? (
                <Button
                  label="Enregistrer cette combinaison"
                  variant="ghost"
                  loading={createCombinaison.isPending}
                  loadingLabel="Enregistrement…"
                  onPress={handleSaveReusable}
                />
              ) : null}

              {combinaisons.length > 0 ? (
                <View style={styles.library}>
                  <Text variant="caption" color="textMuted">
                    Ou rejouer une combinaison enregistrée
                  </Text>
                  {combinaisons.map((c) => (
                    <Button
                      key={c.id}
                      label={`${c.nom} · ${c.nombre_d_éléments} él.`}
                      variant="secondary"
                      onPress={() => onChange(selectReusable(c))}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
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
  linked: {
    gap: spacing.xs,
  },
  library: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
