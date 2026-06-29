import type { MaîtriseDto } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { BarMotif } from '../feed';
import { colors, spacing } from '../theme';
import { Card, StatText, Text } from '../ui';
import { MasteryCurve } from './mastery-curve';
import { formatHauteur, maîtriseAccessibilityLabel } from './metrics-format';

export interface MasteryHeroProps {
  maîtrise: MaîtriseDto;
}

/**
 * **Bloc héros « hauteur maîtrisée »** (UI/UX §4/§6.2, Spec §5.2) — le plafond
 * **fiable** (pas la hauteur brute) : grand chiffre **tabulaire** en vert
 * sous-bois (la couleur de maîtrise, §2), **motif barre** signature, et la
 * **courbe** des barres dans le temps. Le **record gravé** apparaît en référence
 * **laiton** au-dessus du plancher — la maîtrisée **peut redescendre** sans
 * l'effacer (§5.5), et l'UI **assume la baisse sans dramatiser** (§7).
 *
 * Grand chiffre lisible plein soleil (échelle hero, contraste AA+), libellé
 * accessible explicite (§8).
 */
export function MasteryHero({ maîtrise }: MasteryHeroProps) {
  const { courante, record, série } = maîtrise;
  return (
    <Card
      accessibilityRole="summary"
      accessibilityLabel={maîtriseAccessibilityLabel(courante, record)}
    >
      <Text variant="label" color="textMuted" style={styles.kicker}>
        Hauteur maîtrisée
      </Text>

      <View style={styles.figureRow}>
        {/* Motif barre signature, en vert (la barre « validée »). */}
        <BarMotif tone="primary" />
        <View style={styles.numberCol}>
          <View style={styles.numberRow}>
            <StatText variant="hero" color={courante === null ? 'textMuted' : 'primary'}>
              {formatHauteur(courante)}
            </StatText>
            <Text variant="h2" color={courante === null ? 'textMuted' : 'primary'}>
              cm
            </Text>
          </View>
          {courante === null ? (
            <Text variant="caption" color="textMuted">
              Confirme une hauteur sur plusieurs séances pour l’ancrer.
            </Text>
          ) : null}
        </View>

        {/* Record gravé en référence laiton (le plafond, au-dessus du plancher). */}
        {record !== null ? (
          <View style={styles.recordRef}>
            <Text variant="caption" color="textMuted">
              Record
            </Text>
            <View style={styles.recordRow}>
              <StatText variant="stat" color="celebration">
                {record}
              </StatText>
              <Text variant="caption" color="celebration">
                cm
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <MasteryCurve série={série} />
    </Card>
  );
}

const styles = StyleSheet.create({
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numberCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  recordRef: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
});
