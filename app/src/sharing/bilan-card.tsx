import type { CarteBilan } from '@hpt/shared';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarMotif } from '../feed';
import { colors, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';
import { formatCarteDate, fractionRéussie, hauteursRésumé, travailRésumé } from './card-format';

export interface BilanCardProps {
  carte: CarteBilan;
  /** Nom du cheval (signature visuelle, ajoutée par l'app — pas un dérivé). */
  nomCheval: string;
}

/**
 * **Carte de bilan de séance** (UI/UX §6.6) — l'artefact partageable au **format
 * social** : signature **barre** (hauteur-comme-barre, §2) + **nom du cheval** +
 * **logo HPT discret**. Quand la séance bat un record, la carte met le record en
 * avant en **laiton** (réservé à la célébration, §2/§3.1) — c'est « la carte de
 * record » ; sans record, c'est une **carte récap simple**, sans fausse
 * célébration. Une séance de **régularité** (Plat) s'affiche sans hauteur ni taux.
 *
 * `forwardRef` expose la vue à capturer (`react-native-view-shot`, via le port) ;
 * `collapsable={false}` garantit que la vue existe à la capture (Android). Pas
 * d'emoji système (§3.3) : la fête se lit au **laiton** et au **motif barre**.
 */
export const BilanCard = forwardRef<View, BilanCardProps>(function BilanCard(
  { carte, nomCheval },
  ref,
) {
  const hauteurMax = carte.faits?.hauteur_max ?? null;
  const fraction = fractionRéussie(carte);
  const détail = [travailRésumé(carte), hauteursRésumé(carte)]
    .filter((v): v is string => v !== null)
    .join(' · ');
  const aRecord = carte.record !== null;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, aRecord && styles.cardRecord]}
      accessibilityRole="image"
      accessibilityLabel={cardLabel(carte, nomCheval, fraction)}
    >
      {/* En-tête : nom du cheval + logo HPT discret (signature, §2/§6.6). */}
      <View style={styles.header}>
        <Text variant="h2" numberOfLines={1} style={styles.horse}>
          {nomCheval}
        </Text>
        <Text variant="label" color="secondary">
          HPT
        </Text>
      </View>
      <Text variant="caption" color="textMuted">
        {carte.type} · {formatCarteDate(carte.date)}
      </Text>

      {/* Signature barre + grand chiffre (la hauteur du jour), ou régularité. */}
      {hauteurMax !== null ? (
        <View style={styles.heightRow}>
          <BarMotif tone={aRecord ? 'celebration' : 'primary'} />
          <View style={styles.heightText}>
            <StatText variant="hero" color={aRecord ? 'celebration' : 'primary'}>
              {hauteurMax}
            </StatText>
            <Text variant="label" color="textMuted">
              cm
            </Text>
          </View>
        </View>
      ) : (
        <Text variant="h2" color="primary">
          Régularité
        </Text>
      )}

      {/* Ce qui a été travaillé + taux de réussite (couche objective, §1). */}
      {détail ? (
        <Text variant="body" color="text">
          {détail}
        </Text>
      ) : null}
      {fraction ? (
        <Text variant="bodyStrong" color="primary">
          {fraction}
        </Text>
      ) : null}

      {/* Record mis en avant (laiton) — « la carte de record » (§5.4/§6.6). */}
      {carte.record !== null ? (
        <View
          style={styles.recordPlaque}
          accessibilityRole="text"
          accessibilityLabel={`Nouveau record : ${carte.record} centimètres, sans-faute.`}
        >
          <BarMotif tone="celebration" />
          <View style={styles.recordBody}>
            <Text variant="label" color="celebration">
              Nouveau record
            </Text>
            <View style={styles.recordRow}>
              <StatText variant="stat" color="celebration">
                {carte.record}
              </StatText>
              <Text variant="caption" color="celebration">
                cm · sans-faute
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
});

/** Libellé accessible de la carte (lecteurs d'écran, §8) — sobre, sans drama. */
function cardLabel(carte: CarteBilan, nomCheval: string, fraction: string | null): string {
  const parts = [`Bilan de ${nomCheval}, ${carte.type}.`];
  if (carte.faits) parts.push(`Hauteur ${carte.faits.hauteur_max} centimètres.`);
  else parts.push('Séance de régularité.');
  if (fraction) parts.push(`Réussite ${fraction}.`);
  if (carte.record !== null) parts.push(`Nouveau record ${carte.record} centimètres.`);
  return parts.join(' ');
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  // Bordure laiton quand un record est mis en avant (célébration affirmée, §2).
  cardRecord: {
    borderWidth: 1.5,
    borderColor: colors.celebration,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  horse: {
    flexShrink: 1,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heightText: {
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
  recordBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
});
