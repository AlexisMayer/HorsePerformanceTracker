import { Ionicons } from '@expo/vector-icons';
import type { EntréeRégularitéFeed } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Badge, Text } from '../ui';
import { formatFeedDate, provenanceMarqueur, ressentiEmoji } from './labels';

export interface RegularityEntryProps {
  entrée: EntréeRégularitéFeed;
}

/**
 * **Entrée de régularité** (UI/UX §6.2, Modèle §3) — une séance sans
 * franchissement à résumer (un **Plat**, 0 obstacle). Elle marque la
 * **fréquence/continuité** : **pas de hauteur ni de fautes** à afficher (faits
 * absents par construction). Le contexte (ressenti, note) reste en légende (§1).
 * Traitement visuel **sobre** (Encre douce) — c'est la preuve du travail, pas une
 * célébration (le laiton reste réservé aux jalons, §3.1).
 */
export function RegularityEntry({ entrée }: RegularityEntryProps) {
  const marqueur = provenanceMarqueur(entrée.provenance);
  const emoji = ressentiEmoji(entrée.contexte?.ressenti_global);
  const note = entrée.contexte?.note?.trim();

  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={`${formatFeedDate(entrée.date)}, ${entrée.type} — séance de régularité. ${marqueur ?? ''}`}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="footsteps-outline" size={18} color={colors.secondary} />
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text variant="caption" color="textMuted">
            {formatFeedDate(entrée.date)} · {entrée.type}
          </Text>
          {marqueur ? <Badge label={marqueur} tone="neutral" /> : null}
        </View>
        <Text variant="label">Travail de régularité</Text>
        {emoji || note ? (
          <View style={styles.legendRow}>
            {emoji ? <Text variant="body">{emoji}</Text> : null}
            {note ? (
              <Text variant="caption" color="textMuted" style={styles.note} numberOfLines={2}>
                « {note} »
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  note: {
    flex: 1,
    fontStyle: 'italic',
  },
});
