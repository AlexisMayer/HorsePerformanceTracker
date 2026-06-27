import { Stack } from 'expo-router';
import { colors } from '../../theme';

/**
 * Pile des écrans d'auth (inscription, connexion, mot de passe oublié). Sans
 * en-tête natif : chaque écran porte sa propre mise en page (UI/UX §6.1). La
 * redirection vers/depuis ce groupe selon l'état de session est gérée par le
 * layout racine.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
