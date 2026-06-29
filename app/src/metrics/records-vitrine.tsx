import type { Vitrine } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { BarMotif } from '../feed';
import { colors, radius, spacing } from '../theme';
import { Card, StatText, Text } from '../ui';
import { plaquesVitrine } from './metrics-format';

export interface RecordsVitrineProps {
  vitrine: Vitrine;
}

/** Nombre de plaques « premières fois » affichées avant de résumer le reste. */
const PLAQUES_VISIBLES = 6;

/**
 * **Vitrine à records/jalons** (UI/UX §4/§6.2, Spec §5.2) — la **célébration** :
 * plaques **laiton** (réservé aux records/jalons, §3.1, donc rare et précieux). Le
 * **plus haut sans-faute** (record absolu **gravé**, §5.5) est mis en avant, suivi
 * des **premières fois** à chaque hauteur. Réutilise la **détection record/jalon
 * de 3.1** (jamais réimplémentée) ; les « séries propres » (§5.2) restent un
 * enrichissement ultérieur. Pas d'emoji système (§3.3) : la fête se lit au laiton
 * et au motif barre, pas à un 🏆.
 */
export function RecordsVitrine({ vitrine }: RecordsVitrineProps) {
  const { record, premièresFois } = plaquesVitrine(vitrine);
  const visibles = premièresFois.slice(0, PLAQUES_VISIBLES);
  const reste = premièresFois.length - visibles.length;

  return (
    <Card>
      <Text variant="label" color="textMuted" style={styles.kicker}>
        Records & jalons
      </Text>

      {record === null ? (
        <Text variant="caption" color="textMuted">
          Ton premier franchissement propre s’affichera ici.
        </Text>
      ) : (
        <View
          style={styles.recordPlaque}
          accessibilityRole="text"
          accessibilityLabel={`Record : ${record} centimètres, plus haut sans-faute.`}
        >
          <BarMotif tone="celebration" />
          <View style={styles.recordBody}>
            <Text variant="label" color="celebration">
              Plus haut sans-faute
            </Text>
            <View style={styles.recordRow}>
              <StatText variant="stat" color="celebration">
                {record}
              </StatText>
              <Text variant="caption" color="celebration">
                cm · sans-faute
              </Text>
            </View>
          </View>
        </View>
      )}

      {visibles.length > 0 ? (
        <View style={styles.plaquesRow}>
          {visibles.map((hauteur) => (
            <View
              key={hauteur}
              style={styles.plaque}
              accessibilityRole="text"
              accessibilityLabel={`Première fois à ${hauteur} centimètres.`}
            >
              <StatText variant="label" color="celebration">
                {hauteur}
              </StatText>
              <Text variant="caption" color="textMuted">
                cm · 1re fois
              </Text>
            </View>
          ))}
          {reste > 0 ? (
            <View style={styles.plaque}>
              <Text variant="caption" color="textMuted">
                +{reste}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  recordBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  plaquesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  plaque: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
});
