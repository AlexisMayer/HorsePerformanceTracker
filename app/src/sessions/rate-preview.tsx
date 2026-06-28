import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';
import { formatRate } from './draft';

export interface RatePreviewProps {
  rate: number | null;
  /** Légende du dénominateur (« sur 5 efforts », « sur 6 efforts »). */
  basis?: string;
}

/**
 * **Aperçu du taux de réussite** d'une entrée pendant la saisie (Spec §3.2). Le
 * taux vient des **fonctions pures de `shared`** (Modèle §7) — l'aperçu et le
 * calcul serveur **ne peuvent pas diverger** (Architecture §2). Ce n'est **pas**
 * une surface feed/métrique (3.x) : juste un retour immédiat, local, à la
 * saisie. Chiffre tabulaire ; « — » si non calculable.
 */
export function RatePreview({ rate, basis }: RatePreviewProps) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCol}>
        <Text variant="caption" color="textMuted">
          Taux de réussite
        </Text>
        {basis ? (
          <Text variant="caption" color="textMuted">
            {basis}
          </Text>
        ) : null}
      </View>
      <StatText variant="stat" color={rate == null ? 'textMuted' : 'primary'}>
        {formatRate(rate)}
      </StatText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.progressBackground,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  labelCol: {
    gap: 0,
  },
});
