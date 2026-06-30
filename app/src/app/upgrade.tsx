import { Ionicons } from '@expo/vector-icons';
import type { Capacité, OffreSortie, TierPayant } from '@hpt/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useEntitlement } from '../entitlements';
import { useAbonnement, useActualiserAbonnement, useOffres, useUpgrade } from '../subscription';
import { colors, radius, spacing } from '../theme';
import { BackHeader, Button, Card, Screen, Text } from '../ui';

/** Tier le plus bas qui débloque une capacité gatée (miroir de la matrice 4.1). */
const CAPACITÉ_VERS_TIER: Record<Capacité, TierPayant> = {
  analytique_diagnostic: 'premium',
  bilan_augmenté: 'premium',
  bilan_progression: 'premium',
  multi_chevaux: 'pro',
  comptes_invité: 'pro',
};

const AVANTAGES: Record<TierPayant, string[]> = {
  premium: [
    'Analytique de diagnostic',
    'Bilan augmenté par l’IA',
    'Bilan de progression',
    'Combinaisons illimitées',
  ],
  pro: ['Tout Premium', 'Plusieurs chevaux', 'Comptes invité (accès client)'],
};

const TIER_LABEL: Record<TierPayant, string> = { premium: 'Premium', pro: 'Pro' };

/**
 * Écran **paywall / upgrade** (lot 4.2, UI/UX §6.8, Spec §9.3). Propose
 * **premium/pro** (montants **lus de la config serveur**), ouvre le **checkout
 * Mollie**, et au retour **re-lit l'entitlement** (4.1) : déverrouillé, ou état
 * **pending** honnête si le mandat SEPA n'est pas encore confirmé (le tier ne
 * bascule qu'au **webhook** — autorité serveur).
 *
 * Ouvert depuis une **fonction grisée** (`LockedFeature`, param `cap`) ou depuis
 * le **Profil**. Ton **invitant**, jamais culpabilisant (§7).
 */
export default function UpgradeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cap?: string }>();
  const capacité = params.cap as Capacité | undefined;
  const tierRecommandé: TierPayant = (capacité && CAPACITÉ_VERS_TIER[capacité]) || 'premium';

  const offresQuery = useOffres();
  const { entitlement } = useEntitlement();
  const abonnementQuery = useAbonnement();
  const upgrade = useUpgrade();
  const actualiser = useActualiserAbonnement();

  const [tierChoisi, setTierChoisi] = useState<TierPayant>(tierRecommandé);

  const tierActuel = entitlement?.tier ?? 'gratuit';
  const capDébloquée = capacité ? (entitlement?.capacités?.[capacité] ?? false) : false;
  const abonnement = abonnementQuery.data?.abonnement ?? null;
  const enAttente = abonnement?.statut === 'en_attente';
  const offres = offresQuery.data?.offres ?? [];

  const fermer = () => router.back();

  // Déverrouillé : la fonction visée est ouverte (ou on est déjà au tier visé).
  if (capDébloquée || (capacité && estAuMoins(tierActuel, CAPACITÉ_VERS_TIER[capacité]))) {
    return (
      <Screen scroll edges={['top', 'left', 'right']}>
        <BackHeader title="C’est débloqué" onBack={fermer} />
        <Card style={styles.successCard}>
          <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
          <Text variant="h2" style={styles.centered}>
            Tout est débloqué
          </Text>
          <Text variant="body" color="textMuted" style={styles.centered}>
            Ton forfait {TIER_LABEL[tierActuel === 'pro' ? 'pro' : 'premium']} est actif. Profite de
            tes nouvelles fonctions.
          </Text>
          <Button label="Revenir" onPress={fermer} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <BackHeader title="Passer à l’offre supérieure" onBack={fermer} />

      {capacité ? (
        <Text variant="body" color="textMuted">
          Débloque {titrePourCapacité(capacité)} et bien plus.
        </Text>
      ) : null}

      {enAttente ? (
        <Card style={styles.pendingCard}>
          <View style={styles.rowCenter}>
            <Ionicons name="time-outline" size={20} color={colors.secondary} />
            <Text variant="bodyStrong">Paiement en attente</Text>
          </View>
          <Text variant="body" color="textMuted">
            Ton accès {abonnement ? TIER_LABEL[abonnement.tier_cible] : ''} s’ouvrira dès la
            confirmation du paiement. Un prélèvement SEPA peut prendre un peu de temps.
          </Text>
          <Button
            variant="secondary"
            label="Actualiser"
            loadingLabel="Vérification…"
            loading={actualiser.isPending}
            onPress={() => actualiser.mutate()}
          />
        </Card>
      ) : null}

      {offresQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.offres}>
          {offres.map((offre) => (
            <OffreCard
              key={offre.tier}
              offre={offre}
              choisi={tierChoisi === offre.tier}
              recommandé={tierRecommandé === offre.tier}
              déjàActif={estAuMoins(tierActuel, offre.tier)}
              onChoisir={() => setTierChoisi(offre.tier)}
            />
          ))}
        </View>
      )}

      <Button
        label="Continuer"
        loadingLabel="Ouverture du paiement…"
        loading={upgrade.isPending}
        disabled={offres.length === 0 || estAuMoins(tierActuel, tierChoisi)}
        onPress={() => upgrade.mutate(tierChoisi)}
      />

      <Text variant="caption" color="textMuted" style={styles.centered}>
        Paiement sécurisé par Mollie (SEPA ou carte). Sans achat intégré aux stores.
      </Text>
    </Screen>
  );
}

function OffreCard({
  offre,
  choisi,
  recommandé,
  déjàActif,
  onChoisir,
}: {
  offre: OffreSortie;
  choisi: boolean;
  recommandé: boolean;
  déjàActif: boolean;
  onChoisir: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: choisi, disabled: déjàActif }}
      accessibilityLabel={`${TIER_LABEL[offre.tier]}, ${formatPrix(offre)}`}
      onPress={onChoisir}
      disabled={déjàActif}
      style={({ pressed }) => [pressed && !déjàActif && styles.pressed]}
    >
      <Card
        style={[styles.offre, choisi && styles.offreChoisie, déjàActif && styles.offreInactive]}
      >
        <View style={styles.offreHead}>
          <Text variant="h2">{TIER_LABEL[offre.tier]}</Text>
          {recommandé ? (
            <View style={styles.recoPill}>
              <Text variant="caption" color="onPrimary">
                Conseillé
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="stat">{formatPrix(offre)}</Text>
        <View style={styles.avantages}>
          {AVANTAGES[offre.tier].map((a) => (
            <View key={a} style={styles.rowCenter}>
              <Ionicons name="checkmark" size={18} color={colors.primary} />
              <Text variant="body">{a}</Text>
            </View>
          ))}
        </View>
        {déjàActif ? (
          <Text variant="label" color="textMuted">
            Déjà actif
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** Vrai si `tier` ouvre au moins ce que `cible` ouvre (gratuit < premium < pro). */
function estAuMoins(tier: string, cible: TierPayant): boolean {
  const rang: Record<string, number> = { gratuit: 0, premium: 1, pro: 2 };
  return (rang[tier] ?? 0) >= rang[cible];
}

/** Formatte un prix Mollie pour l'affichage FR (ex. « 9,99 € / mois »). */
function formatPrix(offre: OffreSortie): string {
  const symbole = offre.devise === 'EUR' ? '€' : offre.devise;
  const montant = offre.montant.replace('.', ',');
  const cadence = offre.intervalle === '1 month' ? 'mois' : offre.intervalle;
  return `${montant} ${symbole} / ${cadence}`;
}

function titrePourCapacité(capacité: Capacité): string {
  const titres: Record<Capacité, string> = {
    analytique_diagnostic: 'l’analytique de diagnostic',
    bilan_augmenté: 'le bilan augmenté par l’IA',
    bilan_progression: 'le bilan de progression',
    multi_chevaux: 'le suivi de plusieurs chevaux',
    comptes_invité: 'les comptes invité',
  };
  return titres[capacité];
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
  offres: { gap: spacing.md },
  offre: { gap: spacing.sm },
  offreChoisie: { borderColor: colors.primary, borderWidth: 2 },
  offreInactive: { opacity: 0.6 },
  offreHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recoPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  avantages: { gap: spacing.xs, marginTop: spacing.xxs },
  pressed: { opacity: 0.85 },
  successCard: { alignItems: 'center', gap: spacing.sm },
  pendingCard: { borderColor: colors.celebration, gap: spacing.sm },
});
