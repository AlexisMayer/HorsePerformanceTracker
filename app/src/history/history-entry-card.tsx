import { Ionicons } from '@expo/vector-icons';
import type { SéanceSortie } from '@hpt/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { effortsBasis, provenanceMarqueur } from '../feed';
import { formatRate } from '../sessions';
import { colors, radius, spacing } from '../theme';
import { Badge, StatText, Text } from '../ui';
import { type BadgeBilan, badgesBilan, faitsDeSéance, formatHistoryDate } from './history-format';

export interface HistoryEntryCardProps {
  séance: SéanceSortie;
  /**
   * Présence d'un **bilan augmenté** (IA) pour cette séance — pilote le badge `✦`
   * (UI/UX §4). **Slot conditionnel prêt mais vide en 3.4** : l'écran ne le
   * fournit pas (aucune source `ai-bilan` avant le lot **4.5**), donc le `✦` ne
   * s'affiche jamais ici. Voir `badgesBilan`.
   */
  augmentéDisponible?: boolean;
  /** Ré-ouvre le **bilan simple** de la séance (carte 3.3) — l'action de la carte. */
  onOuvrir: () => void;
}

/**
 * **Carte de séance d'historique** (UI/UX §6.4) — date · type, **faits objectifs**
 * (hauteur, fraction propre) ou **régularité** (Plat), et les **badges de bilan**
 * (`✓ simple` toujours ; `✦ augmenté` **seulement si présent** — jamais en 3.4).
 * La carte **entière** est l'affordance qui **rouvre le bilan simple** (carte de
 * 3.3) — cible tactile généreuse (§8). Une séance `déclaratif` est marquée
 * « Antérieure à l'app » (§2). Chiffres tabulaires (`StatText`, §8).
 *
 * Lecture + ré-ouverture **seulement** : pas de nouvelle UX d'édition ici (2.4) —
 * le renvoi vers l'édition existante se fait depuis le bilan rouvert.
 */
export function HistoryEntryCard({ séance, augmentéDisponible, onOuvrir }: HistoryEntryCardProps) {
  const faits = faitsDeSéance(séance);
  const basis = effortsBasis(séance.type);
  const marqueur = provenanceMarqueur(séance.provenance);
  const badges = badgesBilan(augmentéDisponible);

  const résumé = faits
    ? `Hauteur ${faits.hauteur_max} centimètres, ${faits.efforts_propres} sur ${faits.efforts_totaux} ${basis}, ${formatRate(faits.taux_réussite)}.${faits.sans_faute ? ' Sans-faute.' : ''}`
    : 'Séance de régularité.';
  const accessibilityLabel = [
    `${formatHistoryDate(séance.date)}, ${séance.type}.`,
    résumé,
    marqueur ?? '',
    'Ouvrir le bilan simple.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onOuvrir}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <Text variant="caption" color="textMuted">
          {formatHistoryDate(séance.date)} · {séance.type}
        </Text>
        {marqueur ? <Badge label={marqueur} tone="neutral" /> : null}
      </View>

      {/* Faits objectifs en avant, ou régularité pour un Plat (couche objective, §1). */}
      {faits ? (
        <View style={styles.factsRow}>
          <View style={styles.heightCol}>
            <StatText variant="stat">{faits.hauteur_max}</StatText>
            <Text variant="caption" color="textMuted">
              cm
            </Text>
          </View>
          <Text variant="caption" color="textMuted">
            ·
          </Text>
          <View style={styles.rateCol}>
            <StatText variant="stat" color={faits.taux_réussite == null ? 'textMuted' : 'primary'}>
              {faits.efforts_propres}/{faits.efforts_totaux}
            </StatText>
            <Text variant="caption" color="textMuted">
              {basis}
            </Text>
          </View>
          {faits.sans_faute ? <Badge label="Sans-faute" tone="primary" /> : null}
        </View>
      ) : (
        <Text variant="bodyStrong" color="primary">
          Régularité
        </Text>
      )}

      {/* Badges de bilan (UI/UX §4) — `✓ simple` rouvre la carte ; `✦` si présent. */}
      <View style={styles.bilanRow}>
        {badges.map((b) => (
          <BilanBadge key={b} kind={b} />
        ))}
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textMuted}
          style={styles.chevron}
        />
      </View>
    </Pressable>
  );
}

/** Pastille « bilan » avec icône du set (jamais d'emoji système, §3.3). */
function BilanBadge({ kind }: { kind: BadgeBilan }) {
  const cfg =
    kind === 'simple'
      ? { icon: 'checkmark-circle' as const, label: 'Bilan simple', color: colors.primary }
      : { icon: 'sparkles' as const, label: 'Bilan augmenté', color: colors.secondary };
  return (
    <View style={styles.bilanBadge} accessibilityElementsHidden importantForAccessibility="no">
      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
      <Text variant="label" style={{ color: cfg.color }}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  factsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  heightCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  rateCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  bilanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  bilanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  chevron: {
    marginLeft: 'auto',
  },
});
