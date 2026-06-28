import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Text } from '../ui';

export interface DifficultyMarkerProps {
  value: number | null;
  onChange: (next: number | null) => void;
  /** Libellé du marqueur. Défaut : difficulté d'obstacle. */
  label?: string;
}

const LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * Marqueur d'échelle **1-5 optionnelle** — **couche contexte** (Modèle §1/§6.1),
 * **hors du chemin critique** (Spec §3.6) : jamais bloquant, jamais agrégé en
 * métrique. Sert à la **difficulté** d'un obstacle et au **ressenti/énergie** de
 * la séance. Teinte **Cuir** (secondaire) pour le distinguer du Vert sous-bois
 * des faits objectifs. Re-toucher le niveau sélectionné l'efface.
 */
export function DifficultyMarker({
  value,
  onChange,
  label = 'Difficulté ressentie (optionnel)',
}: DifficultyMarkerProps) {
  return (
    <View style={styles.wrapper}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <View style={styles.row}>
        {LEVELS.map((level) => {
          const selected = value === level;
          return (
            <Pressable
              key={level}
              accessibilityRole="button"
              accessibilityLabel={`Difficulté ${level} sur 5`}
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? null : level)}
              style={[styles.dot, selected && styles.dotSelected]}
            >
              <Text
                variant="bodyStrong"
                style={{ color: selected ? colors.onPrimary : colors.textMuted }}
              >
                {level}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
});
