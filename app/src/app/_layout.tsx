import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth';
import { CombinationsProvider } from '../combinations';
import { HorsesProvider, useHorses } from '../horses';
import { shouldEnterOnboarding } from '../onboarding';
import { colors, FONT_ASSETS } from '../theme';

const queryClient = new QueryClient();

/**
 * Layout racine de l'app (Architecture §4, tranche front du lot). Charge les
 * polices (Hanken Grotesk + Inter, UI/UX §3.2), installe les fournisseurs
 * (TanStack Query, zone sûre, auth) et **garde** la navigation : redirection
 * entre le groupe d'auth et les onglets selon l'état de session.
 *
 * Mode **clair uniquement** (UI/UX §8) : `StatusBar` sombre sur fond crème,
 * aucun thème sombre.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  if (!fontsLoaded && !fontError) {
    return <BootScreen />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HorsesProvider>
            <CombinationsProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </CombinationsProvider>
          </HorsesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  const { horses, isLoading: horsesLoading } = useHorses();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (status === 'unauthenticated') {
      if (!inAuthGroup) router.replace('/login');
      return;
    }
    // Authentifié dans le groupe d'auth → rejoindre l'app.
    if (inAuthGroup) {
      router.replace('/');
      return;
    }
    // Nouvel utilisateur (aucun cheval) → tunnel d'onboarding : on en sort avec une
    // récompense déjà vue (Spec §2), jamais sur un feed vide. On ne force jamais la
    // *sortie* du tunnel (l'utilisateur le termine en atterrissant sur le feed).
    if (
      shouldEnterOnboarding({
        authenticated: true,
        horsesLoading,
        horsesCount: horses.length,
        inOnboarding,
      })
    ) {
      router.replace('/onboarding');
    }
  }, [status, segments, router, horsesLoading, horses.length]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      {/* Voile de démarrage : masque tout flash le temps que la session se résolve. */}
      {status === 'loading' ? <BootScreen /> : null}
    </>
  );
}

/** Écran de démarrage neutre (fond crème, mode clair). */
function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
