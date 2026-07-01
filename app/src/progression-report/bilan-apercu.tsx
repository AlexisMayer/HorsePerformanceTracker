import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Card, StatText, Text } from '../ui';

/**
 * **Aperçu grisé** du bilan de progression (lot 4.4) — montré sous le voile +
 * cadenas du `LockedFeature` (4.2) aux comptes **gratuits** : il **montre le
 * livrable** (levier de conversion, Spec §9.4) sans rien calculer. Données
 * **figées** et illustratives (comme l'aperçu démo de 3.5, mais ici c'est le
 * fond grisé du verrou, pas le générateur réel).
 */
export function BilanApercu() {
  return (
    <Card style={styles.card}>
      <Text variant="label" color="textMuted">
        Bilan de progression
      </Text>
      <Text variant="h2">Quibelle · janvier – mars</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <StatText>115 cm</StatText>
          <Text variant="caption" color="textMuted">
            Maîtrisée
          </Text>
        </View>
        <View style={styles.stat}>
          <StatText>18</StatText>
          <Text variant="caption" color="textMuted">
            Séances
          </Text>
        </View>
        <View style={styles.stat}>
          <StatText>4,2</StatText>
          <Text variant="caption" color="textMuted">
            / mois
          </Text>
        </View>
      </View>

      {/* Courbe décorative (signature « hauteur-comme-barre », UI/UX §2). */}
      <View style={styles.chart}>
        {[35, 45, 45, 60, 75, 75, 90].map((h, i) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: barres décoratives figées.
            key={i}
            style={[styles.bar, { height: `${h}%` }]}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xxs },
  stat: { gap: spacing.xxs },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 90,
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.progressBackground,
    borderRadius: radius.sm,
  },
  bar: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.sm - 8 },
});
