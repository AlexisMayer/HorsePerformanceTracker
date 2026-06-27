import type { TypeCompte } from '@hpt/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authErrorMessage, useAuth } from '../../auth';
import { spacing } from '../../theme';
import { Button, Screen, SegmentedControl, Text, TextField } from '../../ui';

const TYPE_OPTIONS: readonly { value: TypeCompte; label: string }[] = [
  { value: 'amateur', label: 'Cavalier' },
  { value: 'coach', label: 'Coach' },
];

/**
 * Écran d'**inscription** (UI/UX §6.1) — câblé sur `POST /auth/register` (1.1),
 * suivi d'une connexion automatique pour ouvrir la session. Le `tier` n'est pas
 * demandé : le serveur le pose à `gratuit` (1.1). La bifurcation cavalier/coach
 * (§6.1) est posée ici ; l'onboarding guidé complet est le lot 3.5.
 */
export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState<TypeCompte>('amateur');

  const submit = () => signUp.mutate({ nom: nom.trim(), email: email.trim(), password, type });
  const error = signUp.error ? authErrorMessage(signUp.error, 'register') : undefined;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="h1">Créer un compte</Text>
        <Text variant="body" color="textMuted">
          Quelques secondes pour commencer à suivre tes progrès.
        </Text>
      </View>

      <SegmentedControl
        label="Tu montes ou tu coaches ?"
        options={TYPE_OPTIONS}
        value={type}
        onChange={setType}
      />
      <TextField
        label="Nom"
        value={nom}
        onChangeText={setNom}
        autoCapitalize="words"
        placeholder="Ton nom"
      />
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
        autoComplete="password-new"
        textContentType="newPassword"
        placeholder="8 caractères minimum"
      />

      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label="Créer mon compte"
        loadingLabel="Création…"
        loading={signUp.isPending}
        onPress={submit}
      />

      <View style={styles.footer}>
        <Text variant="body" color="textMuted">
          Déjà inscrit ?{' '}
        </Text>
        <Link href="/login">
          <Text variant="bodyStrong" color="primary">
            Se connecter
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
