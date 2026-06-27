import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authErrorMessage, useAuth } from '../../auth';
import { spacing } from '../../theme';
import { Button, Screen, Text, TextField } from '../../ui';

/**
 * Écran de **connexion** (UI/UX §6.1) — câblé sur `POST /auth/login` (1.1). Au
 * succès, la session s'ouvre et le layout racine redirige vers les onglets.
 * Voix d'interface (§7) : « Se connecter » → « Connexion… ».
 */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => signIn.mutate({ email: email.trim(), password });
  const error = signIn.error ? authErrorMessage(signIn.error, 'login') : undefined;

  return (
    <Screen scroll center>
      <View style={styles.header}>
        <Text variant="hero">HPT</Text>
        <Text variant="body" color="textMuted">
          Suis la progression de tes chevaux à l'obstacle.
        </Text>
      </View>

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
      <TextField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />

      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label="Se connecter"
        loadingLabel="Connexion…"
        loading={signIn.isPending}
        onPress={submit}
      />

      <Link href="/forgot-password" style={styles.link}>
        <Text variant="label" color="primary">
          Mot de passe oublié ?
        </Text>
      </Link>

      <View style={styles.footer}>
        <Text variant="body" color="textMuted">
          Pas encore de compte ?{' '}
        </Text>
        <Link href="/register">
          <Text variant="bodyStrong" color="primary">
            Créer un compte
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
