import { Ionicons } from '@expo/vector-icons';
import type { BilanAugmentéSortie } from '@hpt/shared';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Card, Text } from '../ui';

/** Formate la date de génération (tolérante au transport ISO) — « 01/07/2026 ». */
function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const jour = String(d.getDate()).padStart(2, '0');
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${d.getFullYear()}`;
}

/**
 * **Carte du bilan augmenté** (lot 4.5, UI/UX §4) — le **texte consultatif**
 * généré par l'IA : analyse de la dernière séance + recommandations pour la
 * prochaine. Marquée du **badge ✦** (icône `sparkles`, teinte **Cuir**
 * `secondary` — cohérent avec le slot ✦ de l'Historique 3.4, jamais le laiton de
 * célébration). Le **disclaimer** (Spec §7.2) est **toujours** affiché : texte
 * clairement **généré par IA**, à valider, ni avis vétérinaire ni substitut au
 * coach. Modèle + version **épinglés** tracés en pied (auditabilité, Stack §3.6).
 *
 * Rendu **identique** à la génération et à la relecture (même DTO) — « relire
 * sans régénérer » ne change rien à l'affichage.
 */
export function AiBilanCard({ bilan }: { bilan: BilanAugmentéSortie }) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={colors.secondary} />
        <Text variant="h2">Bilan augmenté</Text>
        <View style={styles.iaTag}>
          <Text variant="label" style={styles.iaTagText}>
            IA
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          Analyse de la séance
        </Text>
        <Text variant="body">{bilan.contenu.analyse}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          Pour la prochaine séance
        </Text>
        <Text variant="body">{bilan.contenu.recommandations}</Text>
      </View>

      {/* Disclaimer IA — toujours présent (Spec §7.2 : assister sans remplacer). */}
      <View style={styles.disclaimer} accessibilityRole="text">
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text variant="caption" color="textMuted" style={styles.disclaimerText}>
          {bilan.disclaimer}
        </Text>
      </View>

      <Text variant="caption" color="textMuted">
        Généré le {formatDate(bilan.date_génération)} · {bilan.modèle} ({bilan.version})
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderColor: colors.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iaTag: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
  },
  iaTagText: {
    color: colors.secondary,
  },
  section: {
    gap: spacing.xxs,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
  },
  disclaimerText: {
    flex: 1,
  },
});
