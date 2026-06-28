import { sansFaute } from '@hpt/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Badge, Card, Text } from '../ui';
import { clampCounter, type TourDraft } from './draft';
import { HeightBar } from './height-bar';
import { TapCounter } from './tap-counter';

export interface TourEditorProps {
  tour: TourDraft;
  index: number;
  onChange: (patch: Partial<TourDraft>) => void;
  onRemove: () => void;
}

/**
 * Éditeur d'un **tour** de concours (Spec §3.3, Modèle §6.2) : `hauteur · barres
 * · refus`. Le **sans-faute est dérivé** (via `sansFaute` de `shared`), **jamais
 * saisi** — une pastille le reflète en direct.
 */
export function TourEditor({ tour, index, onChange, onRemove }: TourEditorProps) {
  const propre = sansFaute({ barres: tour.barres, refus: tour.refus });
  return (
    <Card>
      <View style={styles.header}>
        <Text variant="h2">Tour {index + 1}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Supprimer le tour ${index + 1}`}
          onPress={onRemove}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        >
          <Text variant="bodyStrong" color="danger">
            ✕
          </Text>
        </Pressable>
      </View>

      <HeightBar value={tour.hauteur} onChange={(hauteur) => onChange({ hauteur })} />

      <View style={styles.counters}>
        <TapCounter
          label="Barres"
          value={tour.barres}
          tone="danger"
          onChange={(barres) => onChange({ barres: clampCounter(barres, 0) })}
        />
        <TapCounter
          label="Refus"
          value={tour.refus}
          tone="danger"
          onChange={(refus) => onChange({ refus: clampCounter(refus, 0) })}
        />
      </View>

      <View style={styles.derived}>
        <Badge
          label={propre ? 'Sans-faute ✓' : 'Avec fautes'}
          tone={propre ? 'primary' : 'danger'}
        />
      </View>
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
    gap: spacing.md,
  },
  derived: {
    flexDirection: 'row',
  },
});
