import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth';
import { guestAcceptErrorMessage, setPendingInvite, useGuestAccess } from '../guest-access';
import { colors, spacing } from '../theme';
import { Button, Card, Screen, Text } from '../ui';

/**
 * **Acceptation d'invitation** (lot 4.6, Spec §9.5 — onboarding invité) — cible du
 * lien reçu par e-mail (`/guest-invite?token=…`). Le jeton est une **capacité au
 * porteur** (comme la vérification d'e-mail 1.2).
 *
 *  - **Non authentifié** : on **mémorise** le jeton (`setPendingInvite`) et on
 *    oriente vers connexion/inscription — le `GuestAccessProvider` **acceptera
 *    automatiquement** une fois le compte relié (l'invité **saute la création de
 *    cheval** et atterrit sur le cheval partagé) ;
 *  - **Authentifié** : on propose de **rejoindre** ; l'acceptation relie le compte
 *    et **atterrit** sur la coquille invité (`/guest`).
 *
 * Route **exemptée** des redirections de la garde de navigation (`app/_layout`) :
 * on ne bascule pas l'invité vers l'onboarding « créer un cheval ».
 */
export default function GuestInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { status } = useAuth();
  const { accept } = useGuestAccess();
  const router = useRouter();

  // Non authentifié : mémorise le jeton pour l'accepter après connexion/inscription.
  useEffect(() => {
    if (status === 'unauthenticated' && token) {
      setPendingInvite(token);
    }
  }, [status, token]);

  if (!token) {
    return (
      <Screen contentStyle={styles.content}>
        <Card>
          <Text variant="bodyStrong">Lien d'invitation invalide</Text>
          <Text variant="body" color="textMuted">
            Ce lien ne contient pas d'invitation valide. Demande à ton coach de te renvoyer une
            invitation.
          </Text>
          <Button variant="secondary" label="Continuer" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  if (status === 'loading') {
    return (
      <Screen contentStyle={styles.content}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Screen contentStyle={styles.content}>
        <Card>
          <Text variant="h2">Rejoindre le suivi de ton coach</Text>
          <Text variant="body" color="textMuted">
            Connecte-toi ou crée ton compte : tu accéderas ensuite, en lecture seule, à la
            progression du cheval que ton coach partage avec toi.
          </Text>
          <View style={styles.actions}>
            <Button label="Créer mon compte" onPress={() => router.replace('/register')} />
            <Button
              variant="secondary"
              label="J'ai déjà un compte"
              onPress={() => router.replace('/login')}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <Card>
        <Text variant="h2">Rejoindre le cheval partagé</Text>
        <Text variant="body" color="textMuted">
          Ton coach t'invite à suivre la progression de son cheval, en lecture seule. Tu pourras
          consulter le feed, les records, l'historique et l'analytique.
        </Text>
        <View style={styles.actions}>
          <Button
            label="Rejoindre"
            loadingLabel="Connexion…"
            loading={accept.isPending}
            onPress={() => accept.mutate(token, { onSuccess: () => router.replace('/guest') })}
          />
          {accept.error ? (
            <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
              {guestAcceptErrorMessage(accept.error)}
            </Text>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  center: {
    alignItems: 'center',
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
