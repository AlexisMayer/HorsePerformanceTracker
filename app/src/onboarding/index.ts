/**
 * Surface app **`onboarding`** (lot 3.5, Architecture §3/§4) — le **tunnel
 * d'accueil** : bifurcation Cavalier/Coach, cheval minimal, **ligne de départ
 * déclarative**, **1re séance guidée**, puis atterrissage sur le **feed** (3.1) +
 * **héros** (3.2). C'est une **surface qui orchestre** `horses` (2.1) et
 * `sessions` (2.2/2.3) — **aucun module backend**, aucun type dupliqué.
 *
 * La logique de tunnel (machine d'étapes, ligne de départ déclarative, données de
 * démo du bilan coach) est **pure** et testée par Vitest ; les écrans réutilisent
 * les composants livrés (formulaire cheval, éditeurs de séance, barre de hauteur,
 * motif barre).
 */
export { BifurcationStep } from './bifurcation-step';
export { BilanDemoCard } from './bilan-demo-card';
export { GuidedSessionStep } from './guided-session-step';
export { HorseStep } from './horse-step';
export {
  defaultPath,
  type OnboardingPath,
  type OnboardingStep,
  shouldEnterOnboarding,
} from './onboarding-flow';
export { OnboardingProgress } from './onboarding-progress';
export { StartingLineStep } from './starting-line-step';
export { useOnboarding } from './use-onboarding';
