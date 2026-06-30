import { Ionicons } from '@expo/vector-icons';
import type { Tier } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth';
import { useCombinations } from '../../combinations';
import { useEntitlement } from '../../entitlements';
import { useHorses } from '../../horses';
import { ouvrirGestionMollie, useAbonnement, useAnnulerAbonnement } from '../../subscription';
import { colors, spacing } from '../../theme';
import { Badge, Button, Card, Screen, Text } from '../../ui';
import { ScreenHeader } from '../../ui/ScreenHeader';

const TIER_LABELS: Record<Tier, string> = {
  gratuit: 'Gratuit',
  premium: 'Premium',
  pro: 'Pro',
};

const TYPE_LABELS: Record<string, string> = {
  amateur: 'Cavalier',
  coach: 'Coach',
};

/**
 * Onglet **Profil** (UI/UX §5) — état minimal du compte (e-mail, `tier`, type) +
 * **déconnexion**. Le `tier` est lu via l'**entitlement** (`GET /me/entitlement`,
 * lot 4.1, lu au login), avec repli sur le compte tant qu'il charge. Il est
 * affiché à titre indicatif — le **gating** reste l'autorité serveur
 * (Architecture §3). Le grisage/paywall des fonctions payantes viendra en 4.2.
 */
export default function ProfilScreen() {
  const { account, signOut, resendEmailVerification } = useAuth();
  const { entitlement } = useEntitlement();
  const { horses } = useHorses();
  const { combinaisons } = useCombinations();
  // Tier issu de l'entitlement (autorité serveur, lu au login) ; repli compte au chargement.
  const tier = entitlement?.tier ?? account?.tier ?? null;
  const router = useRouter();
  const [verificationSent, setVerificationSent] = useState(false);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!account) return;
    setResending(true);
    try {
      await resendEmailVerification(account.email);
      setVerificationSent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <ScreenHeader title="Profil" />

      <Card>
        <Text variant="label" color="textMuted">
          Compte
        </Text>
        <Text variant="h2">{account?.email ?? '—'}</Text>
        <View style={styles.badges}>
          {tier ? <Badge label={TIER_LABELS[tier]} tone="neutral" /> : null}
          {account ? (
            <Badge label={TYPE_LABELS[account.type] ?? account.type} tone="neutral" />
          ) : null}
        </View>
      </Card>

      <AbonnementCard tier={tier} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mes chevaux, ${horses.length} enregistré${horses.length > 1 ? 's' : ''}`}
        onPress={() => router.push('/horses')}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <Ionicons name="paw" size={20} color={colors.primary} />
              <Text variant="bodyStrong">Mes chevaux</Text>
            </View>
            <View style={styles.rowLeft}>
              <Text variant="body" color="textMuted">
                {horses.length}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </View>
        </Card>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mes combinaisons, ${combinaisons.length} enregistrée${combinaisons.length > 1 ? 's' : ''}`}
        onPress={() => router.push('/combinations')}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <Ionicons name="layers" size={20} color={colors.primary} />
              <Text variant="bodyStrong">Mes combinaisons</Text>
            </View>
            <View style={styles.rowLeft}>
              <Text variant="body" color="textMuted">
                {combinaisons.length}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </View>
        </Card>
      </Pressable>

      {account && !account.email_verified ? (
        <Card style={styles.noticeCard}>
          <Text variant="bodyStrong">Vérifie ton e-mail</Text>
          <Text variant="body" color="textMuted">
            {verificationSent
              ? 'Lien envoyé. Ouvre-le depuis ta boîte mail pour confirmer ton adresse.'
              : 'Confirme ton adresse pour sécuriser ton compte.'}
          </Text>
          {!verificationSent ? (
            <Button
              variant="secondary"
              label="Renvoyer le lien"
              loadingLabel="Envoi…"
              loading={resending}
              onPress={handleResend}
            />
          ) : null}
        </Card>
      ) : null}

      <View style={styles.spacer} />

      <Button
        variant="danger"
        label="Se déconnecter"
        loadingLabel="Déconnexion…"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}

/**
 * Carte **Abonnement** (lot 4.2, Spec §9.3) — affiche le forfait et offre :
 *  - en **gratuit** → un point d'entrée vers le **paywall** (`/upgrade`) ;
 *  - en **premium/pro** → **gérer/résilier** (renvoi vers l'espace **Mollie** +
 *    résiliation in-app) ;
 *  - un état **pending** honnête si un paiement (SEPA) n'est pas encore confirmé.
 *
 * Le tier vient de l'entitlement (autorité serveur) ; l'état d'abonnement de
 * `GET /me/subscription`.
 */
function AbonnementCard({ tier }: { tier: Tier | null }) {
  const router = useRouter();
  const { data } = useAbonnement();
  const annuler = useAnnulerAbonnement();
  const abonnement = data?.abonnement ?? null;
  const gestionUrl = data?.gestion_url ?? null;
  const enAttente = abonnement?.statut === 'en_attente';
  const payant = tier === 'premium' || tier === 'pro';

  const confirmerRésiliation = () => {
    Alert.alert(
      'Résilier l’abonnement ?',
      'Ton accès restera actif jusqu’à la fin de la période en cours.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Résilier', style: 'destructive', onPress: () => annuler.mutate() },
      ],
    );
  };

  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.rowLeft}>
          <Ionicons name="card" size={20} color={colors.primary} />
          <Text variant="bodyStrong">Abonnement</Text>
        </View>
        {tier ? <Badge label={TIER_LABELS[tier]} tone={payant ? 'primary' : 'neutral'} /> : null}
      </View>

      {enAttente ? (
        <Text variant="body" color="textMuted">
          Paiement en attente — ton accès s’ouvrira dès la confirmation (un prélèvement SEPA peut
          prendre un peu de temps).
        </Text>
      ) : null}

      {payant ? (
        <View style={styles.aboActions}>
          {gestionUrl ? (
            <Button
              variant="secondary"
              label="Gérer mon abonnement"
              onPress={() => ouvrirGestionMollie(gestionUrl)}
            />
          ) : null}
          <Button
            variant="danger"
            label="Résilier"
            loadingLabel="Résiliation…"
            loading={annuler.isPending}
            onPress={confirmerRésiliation}
          />
        </View>
      ) : (
        <>
          <Text variant="body" color="textMuted">
            Débloque l’analytique, les bilans augmentés et le suivi de plusieurs chevaux.
          </Text>
          <Button label="Voir les forfaits" onPress={() => router.push('/upgrade')} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  noticeCard: {
    borderColor: colors.celebration,
  },
  aboActions: {
    gap: spacing.xs,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.lg,
  },
});
