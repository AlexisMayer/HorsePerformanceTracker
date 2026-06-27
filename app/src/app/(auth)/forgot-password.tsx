import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth';
import { spacing } from '../../theme';
import { Button, Screen, Text, TextField } from '../../ui';

/**
 * Écran **mot de passe oublié** — point d'entrée du lot 1.2, câblé sur `POST
 * /auth/password-reset/request`. **Anti-énumération** (1.2) : la confirmation
 * est la même que le compte existe ou non. La confirmation du reset *via le lien*
 * (jeton en deep link) est différée (voir journal 1.4).
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen scroll center>
      <View style={styles.header}>
        <Text variant="h1">Mot de passe oublié</Text>
        <Text variant="body" color="textMuted">
          Indique ton e-mail : si un compte existe, tu recevras un lien de réinitialisation.
        </Text>
      </View>

      {sent ? (
        <>
          <Text variant="body">
            Si un compte est associé à {email.trim()}, le lien vient d'être envoyé. Vérifie ta boîte
            mail.
          </Text>
          <Button label="Retour à la connexion" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="toi@exemple.fr"
          />
          <Button
            label="Envoyer le lien"
            loadingLabel="Envoi…"
            loading={pending}
            onPress={submit}
          />
          <Button variant="ghost" label="Annuler" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
});
