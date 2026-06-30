import type { TypeCompte } from '@hpt/shared';

/**
 * **Machine d'étapes** du tunnel d'onboarding (lot 3.5, Spec §2, UI/UX §6.1) —
 * logique **pure** (aucun import React Native), donc testable par Vitest. Le
 * tunnel orchestre des surfaces existantes (`horses` 2.1, `sessions` 2.2/2.3,
 * `feed` 3.1, `metrics` 3.2) : il **ne calcule rien** et **n'a pas de module
 * backend** — c'est une surface app (Architecture §3/§4).
 *
 * Deux chemins (bifurcation initiale, Spec §2.1) :
 *  - **Cavalier** (chemin court) : cheval minimal → ligne de départ → 1re séance
 *    guidée → atterrissage feed.
 *  - **Coach** : on insère un **aperçu de bilan** (démo, levier de conversion,
 *    Spec §2.3) **avant** la même configuration — « montrer le livrable avant
 *    toute saisie réelle ».
 *
 * On **sort du tunnel** vers le **vrai feed** (3.1 + héros 3.2), jamais sur un
 * écran de récompense reconstruit : la récompense est déjà vue (Spec §2).
 */

/** Le cavalier monte ses chevaux ; le coach travaille des chevaux de clients. */
export type OnboardingPath = 'cavalier' | 'coach';

/**
 * Étapes du tunnel. `bifurcation` est l'entrée commune ; `bilan-demo` n'existe
 * que sur le chemin coach ; les trois dernières (cheval, ligne de départ, séance
 * guidée) sont **communes** et réutilisent les surfaces livrées.
 */
export type OnboardingStep =
  | 'bifurcation'
  | 'bilan-demo'
  | 'horse'
  | 'starting-line'
  | 'guided-session';

const STEPS: Record<OnboardingPath, readonly OnboardingStep[]> = {
  cavalier: ['bifurcation', 'horse', 'starting-line', 'guided-session'],
  coach: ['bifurcation', 'bilan-demo', 'horse', 'starting-line', 'guided-session'],
};

/** Première étape, commune aux deux chemins (la bifurcation). */
export const FIRST_STEP: OnboardingStep = 'bifurcation';

/**
 * Chemin **proposé par défaut** depuis le `type` de compte (déjà choisi à
 * l'inscription, lot 1.4). La bifurcation reste explicite (Spec §2.1) ; ce défaut
 * ne fait que pré-orienter le choix.
 */
export function defaultPath(type: TypeCompte): OnboardingPath {
  return type === 'coach' ? 'coach' : 'cavalier';
}

/** Suite ordonnée des étapes d'un chemin. */
export function stepsFor(path: OnboardingPath): readonly OnboardingStep[] {
  return STEPS[path];
}

/** Étape suivante du chemin, ou `null` si l'étape courante est la dernière (= fin). */
export function nextStep(path: OnboardingPath, step: OnboardingStep): OnboardingStep | null {
  const steps = STEPS[path];
  const index = steps.indexOf(step);
  if (index < 0 || index === steps.length - 1) return null;
  return steps[index + 1];
}

/** Étape précédente du chemin, ou `null` si l'étape courante est la première. */
export function prevStep(path: OnboardingPath, step: OnboardingStep): OnboardingStep | null {
  const steps = STEPS[path];
  const index = steps.indexOf(step);
  if (index <= 0) return null;
  return steps[index - 1];
}

/** L'étape courante est-elle la **dernière** du chemin (la séance guidée) ? */
export function isLastStep(path: OnboardingPath, step: OnboardingStep): boolean {
  return nextStep(path, step) === null;
}

/**
 * Progression du tunnel, **hors bifurcation** (le choix de chemin n'est pas une
 * « étape de configuration »). Sert à l'indicateur pas-à-pas (« 1 / 3 »). À la
 * bifurcation, `current` vaut 0 (rien d'entamé).
 */
export function progress(
  path: OnboardingPath,
  step: OnboardingStep,
): { current: number; total: number } {
  const real = STEPS[path].filter((s) => s !== 'bifurcation');
  if (step === 'bifurcation') return { current: 0, total: real.length };
  return { current: real.indexOf(step) + 1, total: real.length };
}

/**
 * Le **cheval est-il déjà créé** à cette étape ? Vrai dès la ligne de départ
 * (l'étape `horse` est passée). Sert à **interdire le retour** une fois le cheval
 * posé (revenir recréerait un second cheval — multi-cheval = Pro, 4.x).
 */
export function horseIsCreated(step: OnboardingStep): boolean {
  return step === 'starting-line' || step === 'guided-session';
}

/** Retour arrière autorisé : pas à la bifurcation, et plus une fois le cheval créé. */
export function canGoBack(path: OnboardingPath, step: OnboardingStep): boolean {
  return prevStep(path, step) !== null && !horseIsCreated(step);
}

/**
 * **Doit-on entrer dans le tunnel d'onboarding ?** Décision **pure** consommée
 * par la garde de navigation (`app/_layout`). Un utilisateur **authentifié sans
 * aucun cheval** est un nouvel arrivant : on l'amène au tunnel pour qu'il **sorte
 * avec une récompense déjà vue** (Spec §2), plutôt que sur un feed vide.
 *
 * On n'entre **que** si la liste des chevaux est **résolue** (`!horsesLoading` —
 * pas de redirection sur un état de chargement, qui ferait clignoter) et **vide**,
 * et qu'on **n'y est pas déjà** (jamais de boucle ; on ne force jamais la *sortie*
 * du tunnel, l'utilisateur le termine en atterrissant sur le feed).
 */
export function shouldEnterOnboarding(params: {
  authenticated: boolean;
  horsesLoading: boolean;
  horsesCount: number;
  inOnboarding: boolean;
}): boolean {
  const { authenticated, horsesLoading, horsesCount, inOnboarding } = params;
  return authenticated && !horsesLoading && horsesCount === 0 && !inOnboarding;
}
