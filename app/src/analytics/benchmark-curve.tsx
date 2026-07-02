import { Ionicons } from '@expo/vector-icons';
import type { BenchmarkSérieDto, Tendance } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';
import {
  annotationHauteurs,
  benchmarkAccessibilityLabel,
  courbeBenchmark,
  dernierTaux,
  estMonoPoint,
  formatPourcent,
  tendanceLabel,
} from './benchmark-format';

export interface BenchmarkCurveProps {
  série: BenchmarkSérieDto;
}

const HAUTEUR_COURBE = 72;

/**
 * **Courbe de progression** d'une combinaison à structure constante (lot 5.2,
 * UI/UX §6.5) — conventions de courbe de 3.2 : barres « maison » (pas de dépendance
 * de graphe), **chiffres tabulaires**, le sens porté par le **grand chiffre**
 * (taux courant) + la **tendance**. Chaque instanciation `live` est une barre dont
 * le remplissage suit le **taux §7 combinaison** (100 % = barre pleine) ; une
 * instanciation entièrement fautée est un **creux** honnête. La **hauteur** voyage
 * en **annotation** sous la courbe, jamais confondue avec le taux.
 *
 * La courbe (barres) est **décorative** (masquée aux lecteurs d'écran) ; le sens
 * accessible passe par le libellé du conteneur (`benchmarkAccessibilityLabel`).
 */
export function BenchmarkCurve({ série }: BenchmarkCurveProps) {
  const barres = courbeBenchmark(série.points);
  const courant = dernierTaux(série.points);
  const tendance = tendanceLabel(série.tendance);
  const plage = annotationHauteurs(série.points);
  const mono = estMonoPoint(série.points);
  const fenêtre = série.points.slice(-barres.length);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={benchmarkAccessibilityLabel(série)}>
      <View style={styles.headerRow}>
        <View style={styles.figure}>
          <StatText variant="h1">{courant === null ? '—' : formatPourcent(courant)}</StatText>
          <Text variant="label" color="textMuted">
            % de réussite
          </Text>
        </View>
        {tendance ? <TendanceBadge tendance={série.tendance} label={tendance} /> : null}
      </View>

      <View style={styles.frame} accessible={false} importantForAccessibility="no-hide-descendants">
        {barres.map((b, i) => (
          <View
            key={cléBarre(fenêtre[i]?.date, i)}
            style={[
              styles.bar,
              b.relatif > 0 ? { height: Math.max(4, b.relatif * HAUTEUR_COURBE) } : styles.creux,
            ]}
          />
        ))}
      </View>

      {plage ? (
        <Text variant="caption" color="textMuted">
          Barres travaillées : {plage} — annotation ; la structure de la combinaison reste
          constante.
        </Text>
      ) : null}

      {mono ? (
        <Text variant="caption" color="secondary">
          Une seule instanciation pour l’instant — rejoue cette combinaison pour révéler une
          tendance.
        </Text>
      ) : null}
    </View>
  );
}

/** Petite pastille de tendance (icône + libellé) — honnête, sans dramatiser (§7). */
function TendanceBadge({ tendance, label }: { tendance: Tendance | null; label: string }) {
  const { icône, couleur } = tendanceVisuel(tendance);
  return (
    <View style={styles.badge}>
      <Ionicons name={icône} size={16} color={colors[couleur]} />
      <Text variant="label" color={couleur}>
        {label}
      </Text>
    </View>
  );
}

/** Icône/couleur de la tendance : progression = Vert sous-bois, recul = Cuir (jamais rouille). */
function tendanceVisuel(tendance: Tendance | null): {
  icône: keyof typeof Ionicons.glyphMap;
  couleur: 'primary' | 'secondary' | 'textMuted';
} {
  switch (tendance) {
    case 'hausse':
      return { icône: 'trending-up', couleur: 'primary' };
    case 'baisse':
      return { icône: 'trending-down', couleur: 'secondary' };
    default:
      return { icône: 'remove', couleur: 'textMuted' };
  }
}

/** Clé de liste stable d'une barre : index + date du point (tolérante au transport JSON). */
function cléBarre(date: Date | string | undefined, index: number): string {
  if (date === undefined) return `bar-${index}`;
  const d = date instanceof Date ? date : new Date(date);
  const iso = Number.isNaN(d.getTime()) ? String(date) : d.toISOString();
  return `${index}:${iso}`;
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  figure: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: HAUTEUR_COURBE,
    gap: 3,
  },
  bar: {
    flex: 1,
    minWidth: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  // Creux honnête : une fine ligne de base (pas de barre) — instanciation entièrement fautée.
  creux: {
    height: 3,
    backgroundColor: colors.border,
  },
});
