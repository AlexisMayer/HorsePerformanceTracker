import type { HeatmapDto } from '@hpt/shared';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';
import {
  celluleAccessibilityLabel,
  celluleVisuel,
  formatTaux,
  indexerCellules,
  litCellule,
} from './heatmap-format';

export interface HeatmapGridProps {
  heatmap: HeatmapDto;
}

const TAILLE_CELLULE = 44; // ≥ 44 px : lisible plein soleil, terrain (§8).
const LARGEUR_LIGNE = 92;

/**
 * **Composant heatmap** (UI/UX §4/§6.5) — lignes = types d'obstacle, colonnes =
 * hauteurs présentes ; chaque case est **remplie vert plein → vide** selon le taux
 * §7 (exact, saisie par obstacle), un **« — »** marque l'absence de donnée (jamais
 * confondu avec 0 %, rendu rouille sobre). **Chiffres tabulaires** (`StatText`),
 * contraste AA+ (tokens de thème, §8). Déroulable horizontalement si beaucoup de
 * hauteurs. Purement présentatif : tout le sens vient de `shared` (aucun calcul).
 */
export function HeatmapGrid({ heatmap }: HeatmapGridProps) {
  const index = indexerCellules(heatmap.cellules);

  return (
    <View style={styles.wrap}>
      <View style={styles.legendRow}>
        <Text variant="label" color="textMuted">
          Taux de réussite (%)
        </Text>
        <Text variant="caption" color="textMuted">
          vert plein → vide · — sans donnée
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* En-tête de colonnes : les hauteurs présentes (croissant). */}
          <View style={styles.row}>
            <View style={styles.rowLabelSpacer} />
            {heatmap.hauteurs.map((h) => (
              <View key={`col-${h}`} style={styles.headerCell}>
                <StatText variant="label">{h}</StatText>
              </View>
            ))}
          </View>

          {/* Une ligne par type d'obstacle (Combinaison en dernier — sa propre ligne). */}
          {heatmap.types.map((type) => (
            <View key={type} style={styles.row}>
              <View style={styles.rowLabel}>
                <Text variant="label" numberOfLines={1}>
                  {type}
                </Text>
              </View>
              {heatmap.hauteurs.map((h) => (
                <Cellule
                  key={`${type}-${h}`}
                  cellule={litCellule(index, type, h)}
                  type={type}
                  hauteur={h}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Une case de la grille. Un **fond teinté** (absolu, sous le texte) porte la
 * couleur+opacité ; le **chiffre tabulaire** reste au premier plan à pleine
 * opacité → contraste garanti quel que soit le remplissage (§8). L'aspect (vide /
 * échec / rempli) est décidé par `celluleVisuel` (pur, testé).
 */
function Cellule({
  cellule,
  type,
  hauteur,
}: {
  cellule: ReturnType<typeof litCellule>;
  type: string;
  hauteur: number;
}) {
  const visuel = celluleVisuel(cellule);

  if (visuel.kind === 'vide') {
    return (
      <View
        style={styles.cell}
        accessibilityLabel={celluleAccessibilityLabel(type, hauteur, cellule)}
      >
        <Text variant="label" color="textMuted">
          —
        </Text>
      </View>
    );
  }

  const fond =
    visuel.kind === 'échec'
      ? { backgroundColor: colors.danger, opacity: 0.16 }
      : { backgroundColor: colors.primary, opacity: visuel.opacité };
  const couleurTexte = visuel.kind === 'rempli' && visuel.contrasteFort ? 'onPrimary' : 'text';

  return (
    <View
      style={styles.cell}
      accessibilityLabel={celluleAccessibilityLabel(type, hauteur, cellule)}
    >
      <View style={[StyleSheet.absoluteFill, styles.fill, fond]} />
      {/* `cellule` est défini dès que la case n'est pas « vide ». */}
      <StatText variant="label" color={couleurTexte}>
        {cellule ? formatTaux(cellule.taux) : '—'}
      </StatText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  rowLabelSpacer: {
    width: LARGEUR_LIGNE,
  },
  rowLabel: {
    width: LARGEUR_LIGNE,
    paddingRight: spacing.xs,
  },
  headerCell: {
    width: TAILLE_CELLULE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    width: TAILLE_CELLULE,
    height: TAILLE_CELLULE,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.sm,
  },
});
