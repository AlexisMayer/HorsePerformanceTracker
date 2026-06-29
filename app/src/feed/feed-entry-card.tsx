import type { EntréeSéanceFeed } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { formatDateModification, formatRate } from '../sessions';
import { colors, radius, spacing } from '../theme';
import { Badge, StatText, Text } from '../ui';
import { effortsBasis, formatFeedDate, provenanceMarqueur, ressentiEmoji } from './labels';

export interface FeedEntryCardProps {
  entrée: EntréeSéanceFeed;
}

/**
 * **Carte d'entrée de feed** (UI/UX §4) — une séance avec des franchissements.
 * **Deux couches étanches (Modèle §1)** : les **faits objectifs en avant**
 * (hauteur, fraction propre, taux) ; le **contexte qualitatif en légende**
 * (emoji ressenti, note, énergie) — décor, jamais agrégé. Une séance `déclaratif`
 * est marquée « Antérieure à l'app » (§2). Chiffres tabulaires (StatText, §8).
 *
 * Affichage seul (la navigation vers le détail/édition est l'affaire de
 * l'historique, 3.4) ; libellé accessible explicite (§8).
 */
export function FeedEntryCard({ entrée }: FeedEntryCardProps) {
  const { faits, contexte } = entrée;
  const basis = effortsBasis(entrée.type);
  const marqueur = provenanceMarqueur(entrée.provenance);
  const emoji = ressentiEmoji(contexte?.ressenti_global);
  const note = contexte?.note?.trim();
  const dateModif = formatDateModification(entrée.date_modification);

  const accessibilityLabel = [
    `${formatFeedDate(entrée.date)}, ${entrée.type}.`,
    `Hauteur ${faits.hauteur_max} centimètres.`,
    `${faits.efforts_propres} sur ${faits.efforts_totaux} ${basis}, ${formatRate(faits.taux_réussite)}.`,
    faits.sans_faute ? 'Sans-faute.' : '',
    marqueur ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.card} accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
      <View style={styles.headerRow}>
        <Text variant="caption" color="textMuted">
          {formatFeedDate(entrée.date)} · {entrée.type}
        </Text>
        {marqueur ? <Badge label={marqueur} tone="neutral" /> : null}
      </View>

      {/* Faits objectifs en avant (couche colonne vertébrale). */}
      <View style={styles.factsRow}>
        <View style={styles.heightCol}>
          <StatText variant="stat">{faits.hauteur_max}</StatText>
          <Text variant="caption" color="textMuted">
            cm
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          ·
        </Text>
        <View style={styles.rateCol}>
          <StatText variant="stat" color={faits.taux_réussite == null ? 'textMuted' : 'primary'}>
            {faits.efforts_propres}/{faits.efforts_totaux}
          </StatText>
          <Text variant="caption" color="textMuted">
            {basis} · {formatRate(faits.taux_réussite)}
          </Text>
        </View>
        {faits.sans_faute ? <Badge label="Sans-faute" tone="primary" /> : null}
      </View>

      {/* Contexte qualitatif en légende (jamais agrégé, §1). */}
      {emoji || note ? (
        <View style={styles.legendRow}>
          {emoji ? <Text variant="body">{emoji}</Text> : null}
          {note ? (
            <Text variant="caption" color="textMuted" style={styles.note} numberOfLines={3}>
              « {note} »
            </Text>
          ) : null}
        </View>
      ) : null}

      {dateModif ? (
        <Text variant="caption" color="textMuted">
          {dateModif}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  factsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  heightCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  rateCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
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
