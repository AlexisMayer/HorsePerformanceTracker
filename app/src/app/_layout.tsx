import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth';
import { CombinationsProvider } from '../combinations';
import { EntitlementsProvider } from '../entitlements';
import {
  GuestAccessProvider,
  guestStateUnresolved,
  shouldEnterGuestShell,
  useGuestAccess,
} from '../guest-access';
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
          <EntitlementsProvider>
            <HorsesProvider>
              <CombinationsProvider>
                <GuestAccessProvider>
                  <StatusBar style="dark" />
                  <RootNavigator />
                </GuestAccessProvider>
              </CombinationsProvider>
            </HorsesProvider>
          </EntitlementsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  const { horses, isLoading: horsesLoading } = useHorses();
  const { sharedHorses, isLoading: guestLoading } = useGuestAccess();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inGuest = segments[0] === 'guest';
    // Écran d'acceptation d'invitation (deep link) : il gère lui-même l'auth et
    // l'atterrissage — la garde ne le redirige pas (sinon un invité pur serait
    // bousculé vers l'onboarding « créer un cheval » avant d'avoir pu accepter).
    const inGuestInvite = segments[0] === 'guest-invite';

    if (status === 'unauthenticated') {
      if (!inAuthGroup && !inGuestInvite) router.replace('/login');
      return;
    }
    // Authentifié dans le groupe d'auth → rejoindre l'app.
    if (inAuthGroup) {
      router.replace('/');
      return;
    }
    // Acceptation d'invitation : laisser l'écran conclure (il route vers /guest).
    if (inGuestInvite) return;
    // Coquille invité (lot 4.6, Spec §9.5) : un **invité pur** (aucun cheval possédé
    // + ≥ 1 accès partagé) atterrit sur la coquille invité en **sautant** la création
    // de cheval — l'onboarding invité ne recrée jamais de cheval.
    if (
      shouldEnterGuestShell({
        authenticated: true,
        horsesLoading,
        horsesCount: horses.length,
        guestLoading,
        sharedHorsesCount: sharedHorses.length,
        inGuest,
      })
    ) {
      router.replace('/guest');
      return;
    }
    // Ne pas trancher l'onboarding tant que l'état invité n'est pas résolu (évite
    // d'envoyer un invité vers « créer un cheval » avant de savoir qu'il est invité).
    if (guestStateUnresolved({ authenticated: true, horsesCount: horses.length, guestLoading })) {
      return;
    }
    // Nouvel utilisateur **régulier** (aucun cheval, aucun accès partagé) → tunnel
    // d'onboarding : on en sort avec une récompense déjà vue (Spec §2), jamais sur un
    // feed vide. Un invité (accès partagé) en est **exclu** (coquille invité ci-dessus).
    if (
      sharedHorses.length === 0 &&
      shouldEnterOnboarding({
        authenticated: true,
        horsesLoading,
        horsesCount: horses.length,
        inOnboarding,
      })
    ) {
      router.replace('/onboarding');
    }
  }, [status, segments, router, horsesLoading, horses.length, guestLoading, sharedHorses.length]);

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
