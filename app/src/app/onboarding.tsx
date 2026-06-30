import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../auth';
import {
  BifurcationStep,
  BilanDemoCard,
  defaultPath,
  GuidedSessionStep,
  HorseStep,
  OnboardingProgress,
  StartingLineStep,
  useOnboarding,
} from '../onboarding';
import { spacing } from '../theme';
import { BackHeader, Button, Screen, Text } from '../ui';

/**
 * Écran du **tunnel d'onboarding** (lot 3.5, Spec §2, UI/UX §6.1). Un seul écran
 * **pilote la machine d'étapes** (`useOnboarding`) et rend l'étape courante : la
 * **bifurcation**, l'**aperçu de bilan** (coach), la **création du cheval** (2.1),
 * la **ligne de départ** déclarative (2.2) et la **1re séance guidée** (2.3).
 *
 * On **n'a pas** d'écran de récompense reconstruit : à la fin du tunnel, on
 * **atterrit sur le vrai feed** (`/`, lot 3.1 + héros 3.2) — la ligne de départ y
 * figure déjà (Spec §2). La **garde** de `app/_layout` amène ici tout nouvel
 * utilisateur (authentifié, sans cheval).
 */
export default function OnboardingScreen() {
  const { account } = useAuth();
  const router = useRouter();
  const ob = useOnboarding(account);

  // Fin du tunnel → atterrissage sur le feed (la récompense déjà vue).
  useEffect(() => {
    if (ob.done) router.replace('/');
  }, [ob.done, router]);

  return (
    <Screen scroll contentStyle={styles.content}>
      {ob.canGoBack ? <BackHeader title="" onBack={ob.goBack} /> : null}
      <OnboardingProgress current={ob.progress.current} total={ob.progress.total} />

      {ob.step === 'bifurcation' ? (
        <BifurcationStep
          recommended={defaultPath(account?.type ?? 'amateur')}
          onChoose={ob.choosePath}
        />
      ) : null}

      {ob.step === 'bilan-demo' ? (
        <View style={styles.block}>
          <View style={styles.header}>
            <Text variant="h1">Le livrable de tes clients</Text>
            <Text variant="body" color="textMuted">
              Voici le bilan de progression que tu pourras partager — avant même ta première saisie.
              Il se remplira avec tes vraies séances.
            </Text>
          </View>
          <BilanDemoCard />
          <Button label="Configurer mon premier cheval" onPress={ob.advance} />
        </View>
      ) : null}

      {ob.step === 'horse' ? <HorseStep path={ob.path} onCreated={ob.recordHorse} /> : null}

      {ob.step === 'starting-line' && ob.horse ? (
        <StartingLineStep
          chevalId={ob.horse.id}
          defaultHauteur={ob.horse.hauteur_de_référence}
          onDone={ob.advance}
        />
      ) : null}

      {ob.step === 'guided-session' && ob.horse ? (
        <GuidedSessionStep
          chevalId={ob.horse.id}
          horseName={ob.horse.nom}
          onComplete={ob.advance}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  block: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
});
