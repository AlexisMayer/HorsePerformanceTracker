import type { PointMaîtriseDto } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { courbeMaîtrise } from './metrics-format';

export interface MasteryCurveProps {
  série: PointMaîtriseDto[];
}

const HAUTEUR_COURBE = 56;

/**
 * **Courbe de hauteur maîtrisée** en barres (UI/UX §2 — « la progression se lit
 * comme des barres qui montent »). Pas de dépendance de graphe : chaque séance
 * `live` devient une **barre vert sous-bois** dont la taille suit la maîtrisée du
 * moment. Une baisse (régression, §5.5) se lit par des barres plus courtes, un
 * point non maîtrisé par un **creux** (fine ligne de base) — assumé sans drama.
 *
 * Décoratif : le sens (le grand chiffre) est porté par le bloc parent ; la courbe
 * est masquée aux lecteurs d'écran (évite un brouhaha de barres).
 */
export function MasteryCurve({ série }: MasteryCurveProps) {
  const barres = courbeMaîtrise(série);
  if (barres.length === 0) return null;

  // Clé stable par barre : la date (distincte) de la séance affichée, zippée sur
  // la même fenêtre que la courbe — pas d'index dans la clé JSX (liste figée).
  const fenêtre = série.slice(-barres.length);
  const items = barres.map((b, i) => ({ ...b, clé: cléBarre(fenêtre[i]?.date, i) }));

  return (
    <View style={styles.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      {items.map((b) => (
        <View
          key={b.clé}
          style={[
            styles.bar,
            b.relatif > 0 ? { height: Math.max(4, b.relatif * HAUTEUR_COURBE) } : styles.creux,
          ]}
        />
      ))}
    </View>
  );
}

/** Clé de liste stable d'une barre : index + date du point (tolérante au transport JSON). */
function cléBarre(date: Date | string | undefined, index: number): string {
  if (date === undefined) return `bar-${index}`;
  const d = date instanceof Date ? date : new Date(date);
  const iso = Number.isNaN(d.getTime()) ? String(date) : d.toISOString();
  return `${index}:${iso}`;
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: HAUTEUR_COURBE,
    gap: 3,
  },
  bar: {
    flex: 1,
    minWidth: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  // Creux honnête : une fine ligne de base (pas de barre) — la maîtrise est absente.
  creux: {
    height: 3,
    backgroundColor: colors.border,
  },
});
