import { Ionicons } from '@expo/vector-icons';
import type { Tier } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth';
import { useHorses } from '../../horses';
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
 * Onglet **Profil** (UI/UX §5) — état minimal du compte (e-mail, `tier` lu au
 * login, type) + **déconnexion**. La gestion d'abonnement, des chevaux et des
 * invités viendra avec ses lots (4.x / 2.1). Le `tier` est affiché à titre
 * indicatif — le **gating** reste l'autorité serveur (Architecture §3).
 */
export default function ProfilScreen() {
  const { account, signOut, resendEmailVerification } = useAuth();
  const { horses } = useHorses();
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
          {account ? <Badge label={TIER_LABELS[account.tier]} tone="neutral" /> : null}
          {account ? (
            <Badge label={TYPE_LABELS[account.type] ?? account.type} tone="neutral" />
          ) : null}
        </View>
      </Card>

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
  spacer: {
    flex: 1,
    minHeight: spacing.lg,
  },
});
