import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEntitlement } from '../entitlements';
import { colors, spacing } from '../theme';
import { Badge, Button, Card, Text, TextField } from '../ui';
import { guestInviteErrorMessage } from './guest-error-messages';
import { useGuestInvites } from './use-guest-invites';

/**
 * **Inviter un client** depuis la fiche cheval (lot 4.6, Spec §9.5, UI/UX §5) —
 * surface de **gestion** du coach : inviter (par e-mail), voir les accès et
 * **révoquer**. **Pro uniquement** : si la capacité `comptes_invité` n'est pas
 * débloquée, on **grise** (invitation à passer Pro, verrouillage = invitation,
 * §7) — le **serveur** reste l'autorité (403 sinon). Un cheval peut porter
 * **plusieurs** invités (propriétaire + cavalier…).
 */
export function GuestInvitesSection({ chevalId }: { chevalId: string }) {
  const { entitlement } = useEntitlement();
  const router = useRouter();
  const débloqué = entitlement?.capacités?.comptes_invité ?? false;

  if (!débloqué) {
    return (
      <Card>
        <Text variant="bodyStrong">Partager avec ton client</Text>
        <Text variant="body" color="textMuted">
          Avec le forfait Pro, invite le propriétaire ou le cavalier à suivre la progression de ce
          cheval en lecture seule — une fenêtre vivante qui remplace l'envoi de rapports.
        </Text>
        <Button
          variant="secondary"
          label="Passer au Pro"
          onPress={() => router.push({ pathname: '/upgrade', params: { cap: 'comptes_invité' } })}
        />
      </Card>
    );
  }

  return <GuestInvitesManager chevalId={chevalId} />;
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  actif: 'Actif',
  révoqué: 'Révoqué',
};

/** Contenu débloqué (Pro) : formulaire d'invitation + liste des accès + révocation. */
function GuestInvitesManager({ chevalId }: { chevalId: string }) {
  const { invites, invite, revoke } = useGuestInvites(chevalId);
  const [email, setEmail] = useState('');

  // Les accès révoqués disparaissent de la gestion (on ré-invite plutôt).
  const actifs = invites.filter((a) => a.statut !== 'révoqué');

  const submit = () => {
    const valeur = email.trim();
    if (!valeur) return;
    invite.mutate(valeur, { onSuccess: () => setEmail('') });
  };

  return (
    <Card>
      <Text variant="bodyStrong">Comptes invité</Text>
      <Text variant="body" color="textMuted">
        Invite ton client (par e-mail) à consulter ce cheval en lecture seule. Il installe l'app,
        relie son compte et accède au feed, aux records, à l'historique et à l'analytique.
      </Text>

      <View style={styles.form}>
        <TextField
          label="E-mail du client"
          placeholder="client@exemple.fr"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={invite.error ? guestInviteErrorMessage(invite.error) : undefined}
        />
        <Button label="Inviter" loadingLabel="Envoi…" loading={invite.isPending} onPress={submit} />
        {invite.isSuccess ? (
          <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
            Invitation envoyée. Ton client la recevra par e-mail.
          </Text>
        ) : null}
      </View>

      {actifs.length > 0 ? (
        <View style={styles.list}>
          {actifs.map((accès) => (
            <View key={accès.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text variant="body" numberOfLines={1} style={styles.rowEmail}>
                  {accès.invité_email}
                </Text>
                <Badge
                  label={STATUT_LABELS[accès.statut] ?? accès.statut}
                  tone={accès.statut === 'actif' ? 'primary' : 'neutral'}
                />
              </View>
              <Button
                variant="ghost"
                fullWidth={false}
                label="Révoquer"
                loading={revoke.isPending && revoke.variables === accès.id}
                onPress={() => revoke.mutate(accès.id)}
              />
            </View>
          ))}
          {revoke.error ? (
            <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
              {guestInviteErrorMessage(revoke.error)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  list: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowEmail: {
    flexShrink: 1,
  },
});
