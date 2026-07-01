import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '../auth/api-client';
import { LockedFeature } from '../entitlements';
import { colors, radius, spacing } from '../theme';
import { Button, Card, Text } from '../ui';
import { AiBilanCard } from './ai-bilan-card';
import { useGénérerBilanAugmenté } from './use-ai-bilan';

/**
 * **Section « Générer le bilan augmenté »** proposée à l'**enregistrement**
 * (lot 4.5, Spec §7.1). Réutilise le **verrou générique 4.2** (`LockedFeature`,
 * capacité `bilan_augmenté`) :
 *  - **premium/pro** → le vrai générateur (bouton **à la demande**, jamais
 *    automatique) ;
 *  - **gratuit** → un aperçu **grisé** sous voile + cadenas dont l'appui ouvre
 *    l'upgrade (verrouillage = invitation, §7). **Refusé au gratuit**, sans
 *    culpabiliser.
 *
 * L'invité (4.6) n'y a pas accès (il n'a pas la capacité) — cohérent Spec §9.5.
 */
export function AugmentedBilanSection({
  seanceId,
  chevalId,
}: {
  seanceId: string;
  chevalId: string;
}) {
  return (
    <LockedFeature
      capacité="bilan_augmenté"
      titre="Bilan augmenté par l’IA"
      aperçu={<AugmentedBilanApercu />}
    >
      <AugmentedBilanGenerator seanceId={seanceId} chevalId={chevalId} />
    </LockedFeature>
  );
}

/** Message d'erreur adapté (rate limit vs autre) — dit quoi faire, sans jargon. */
function messageErreur(error: Error): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de bilans augmentés générés récemment. Réessaie un peu plus tard.';
  }
  return 'Impossible de générer le bilan augmenté pour le moment. Réessaie dans un instant.';
}

/**
 * Le **vrai générateur** (premium/pro) : un bouton **explicite** (jamais
 * automatique, Spec §7.1). Au succès, la carte ✦ s'affiche (avec disclaimer). La
 * relecture ultérieure se fait depuis l'Historique **sans régénération** (§7.3).
 */
function AugmentedBilanGenerator({ seanceId, chevalId }: { seanceId: string; chevalId: string }) {
  const bilan = useGénérerBilanAugmenté(seanceId, chevalId);

  if (bilan.data) {
    return <AiBilanCard bilan={bilan.data} />;
  }

  return (
    <Card style={styles.promo}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={colors.secondary} />
        <Text variant="h2">Bilan augmenté par l’IA</Text>
      </View>
      <Text variant="body" color="textMuted">
        Une analyse de cette séance et des recommandations pour la prochaine, rédigées par
        l’assistant IA. Généré uniquement quand tu le demandes.
      </Text>
      <Button
        label="Générer le bilan augmenté"
        loadingLabel="Génération…"
        loading={bilan.isPending}
        onPress={() => bilan.mutate()}
      />
      {bilan.error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {messageErreur(bilan.error)}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * **Aperçu grisé** (levier de conversion, Spec §9.4) — montré sous le voile +
 * cadenas du `LockedFeature` aux comptes **gratuits** : il **montre le livrable**
 * (une carte ✦ illustrative) sans rien générer. Données **figées**.
 */
function AugmentedBilanApercu() {
  return (
    <Card style={styles.apercu}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={colors.secondary} />
        <Text variant="h2">Bilan augmenté par l’IA</Text>
      </View>
      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          Analyse de la séance
        </Text>
        <Text variant="body">
          Belle progression à l’obstacle : la barre semble se stabiliser sur les dernières séances.
        </Text>
      </View>
      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          Pour la prochaine séance
        </Text>
        <Text variant="body">
          Tenter quelques passages un cran au-dessus, en gardant des répétitions courtes.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  promo: {
    gap: spacing.sm,
    borderColor: colors.secondary,
  },
  apercu: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  section: {
    gap: spacing.xxs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
  },
});
