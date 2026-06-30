import { StyleSheet, View } from 'react-native';
import { BarMotif } from '../feed';
import { colors, radius, spacing } from '../theme';
import { Badge, StatText, Text } from '../ui';
import { BILAN_DEMO, bilanDemoTrajectoireLabel } from './bilan-demo';

const TRAJ_HEIGHT = 48;

/**
 * **Aperçu de bilan de progression — démonstration** (chemin coach, Spec §2.3).
 * Montre à quoi ressemble le **livrable client** (Spec §6) *avant toute saisie
 * réelle* : niveau démontré, régularité (le cœur), trajectoire. C'est le levier
 * de conversion principal.
 *
 * **Consigne** : ce n'est **pas** le générateur réel (lot 4.4). Tout vient de
 * `BILAN_DEMO` (données statiques), et la carte est **explicitement marquée**
 * « Aperçu · exemple » — on ne fait jamais croire à de vraies données. La signature
 * barre (§2) et le record en **laiton** (réservé à la célébration) sont réutilisés
 * tels quels.
 */
export function BilanDemoCard() {
  const demo = BILAN_DEMO;
  const min = Math.min(...demo.trajectoire);
  const max = Math.max(...demo.trajectoire);
  const étendue = max - min;
  const barres = demo.trajectoire.map((h, i) => ({
    key: `${i}:${h}`,
    ratio: étendue > 0 ? 0.3 + (0.7 * (h - min)) / étendue : 1,
  }));

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.header}>
        <Text variant="h2">Bilan de progression</Text>
        <Badge label="Aperçu · exemple" tone="neutral" />
      </View>
      <Text variant="caption" color="textMuted">
        {demo.cheval} · {demo.niveau} · {demo.période}
      </Text>

      {/* Niveau démontré : maîtrisée (vert) + record gravé (laiton, §5.5). */}
      <View style={styles.level}>
        <View style={styles.levelBlock}>
          <Text variant="label" color="textMuted">
            Hauteur maîtrisée
          </Text>
          <View style={styles.statRow}>
            <BarMotif tone="primary" />
            <View style={styles.statText}>
              <StatText variant="hero" color="primary">
                {demo.maîtrisée}
              </StatText>
              <Text variant="label" color="textMuted">
                cm
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.recordPlaque} accessibilityLabel={`Record ${demo.record} centimètres`}>
          <BarMotif tone="celebration" />
          <View>
            <Text variant="label" color="celebration">
              Record
            </Text>
            <View style={styles.statText}>
              <StatText variant="stat" color="celebration">
                {demo.record}
              </StatText>
              <Text variant="caption" color="celebration">
                cm
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Trajectoire : courbe décorative (signature barres), libellée pour §8. */}
      <View style={styles.trajBlock}>
        <Text variant="label" color="textMuted">
          Trajectoire
        </Text>
        <View
          style={styles.traj}
          accessibilityRole="image"
          accessibilityLabel={bilanDemoTrajectoireLabel(demo)}
        >
          {barres.map((b) => (
            <View
              key={b.key}
              style={[styles.trajBar, { height: Math.max(4, b.ratio * TRAJ_HEIGHT) }]}
            />
          ))}
        </View>
      </View>

      {/* Régularité : la preuve du travail fourni (cœur du bilan, §6.1). */}
      <View style={styles.regularity}>
        <Text variant="bodyStrong">Régularité</Text>
        <Text variant="body" color="textMuted">
          {demo.séances} séances sur {demo.semaines} semaines — la preuve du travail fourni.
        </Text>
      </View>

      <Text variant="caption" color="textMuted">
        Données de démonstration. Ton vrai bilan se construit au fil de tes séances.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  level: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  levelBlock: {
    gap: spacing.xxs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  recordPlaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.celebration,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  trajBlock: {
    gap: spacing.xs,
  },
  traj: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: TRAJ_HEIGHT,
    gap: 3,
  },
  trajBar: {
    flex: 1,
    minWidth: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  regularity: {
    gap: spacing.xxs,
  },
});
