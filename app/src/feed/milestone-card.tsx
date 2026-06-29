import type { EntréeJalonFeed } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';
import { BarMotif } from './bar-motif';
import { jalonTitre } from './labels';

export interface MilestoneCardProps {
  entrée: EntréeJalonFeed;
}

/**
 * **Carte de jalon** injectée dans le fil (UI/UX §2/§3) — la **célébration** :
 * laiton (réservé aux records/jalons, §3.1, donc rare et précieux) + **motif
 * barre** (signature « hauteur-comme-barre »). Pas d'emoji système ici (§3.3 ne
 * l'autorise que pour le ressenti) : la fête se lit par le **laiton** et l'icône
 * barre, pas par un 🎉. Dérivé, jamais saisi (§9) ; absent du `déclaratif` (§2).
 */
export function MilestoneCard({ entrée }: MilestoneCardProps) {
  const titre = jalonTitre(entrée.type_jalon);
  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={`${titre} : ${entrée.hauteur} centimètres, franchissement propre.`}
    >
      <BarMotif tone="celebration" />
      <View style={styles.body}>
        <Text variant="label" color="celebration">
          {titre}
        </Text>
        <View style={styles.heightRow}>
          <StatText variant="stat" color="celebration">
            {entrée.hauteur}
          </StatText>
          <Text variant="caption" color="celebration">
            cm · sans-faute
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    // Laiton en bordure : célébration affirmée sans noyer la carte de laiton plein.
    borderColor: colors.celebration,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
});
