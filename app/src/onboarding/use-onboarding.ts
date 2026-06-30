import type { ChevalSortie, CompteSortie } from '@hpt/shared';
import { useCallback, useState } from 'react';
import {
  canGoBack as canGoBackFor,
  defaultPath,
  FIRST_STEP,
  nextStep,
  type OnboardingPath,
  type OnboardingStep,
  prevStep,
  progress as progressFor,
} from './onboarding-flow';

/**
 * Orchestration **de l'état** du tunnel d'onboarding (lot 3.5). Tient le chemin
 * choisi, l'étape courante et le cheval créé ; expose des transitions **dérivées
 * de la machine pure** (`onboarding-flow`). La navigation (atterrissage sur le
 * feed) reste à l'écran : ici on signale seulement la fin (`done`).
 *
 * Les **mutations** (création du cheval via `horses` 2.1, ligne de départ et
 * séance via `sessions` 2.2/2.3) vivent dans les **composants d'étape**, qui
 * appellent ces transitions à leur succès — le tunnel ne réimplémente aucune
 * logique de domaine (Architecture §3/§4).
 */
export interface OnboardingState {
  path: OnboardingPath;
  step: OnboardingStep;
  /** Cheval créé à l'étape `horse` (source de la hauteur de référence ensuite). */
  horse: ChevalSortie | null;
  /** Vrai quand le tunnel est terminé : l'écran atterrit alors sur le feed. */
  done: boolean;
  /** Progression hors bifurcation (« étape n / total ») pour l'indicateur. */
  progress: { current: number; total: number };
  /** Retour arrière autorisé (jamais une fois le cheval créé). */
  canGoBack: boolean;
  /** Bifurcation : fixe le chemin (Cavalier/Coach) et passe à l'étape suivante. */
  choosePath: (path: OnboardingPath) => void;
  /** Enregistre le cheval créé (2.1) et avance vers la ligne de départ. */
  recordHorse: (horse: ChevalSortie) => void;
  /** Avance d'une étape ; à la dernière, termine le tunnel (`done`). */
  advance: () => void;
  /** Recule d'une étape (si autorisé). */
  goBack: () => void;
}

export function useOnboarding(account: CompteSortie | null): OnboardingState {
  const [path, setPath] = useState<OnboardingPath>(() => defaultPath(account?.type ?? 'amateur'));
  const [step, setStep] = useState<OnboardingStep>(FIRST_STEP);
  const [horse, setHorse] = useState<ChevalSortie | null>(null);
  const [done, setDone] = useState(false);

  const advance = useCallback(() => {
    const next = nextStep(path, step);
    if (next === null) setDone(true);
    else setStep(next);
  }, [path, step]);

  const choosePath = useCallback((chosen: OnboardingPath) => {
    setPath(chosen);
    const next = nextStep(chosen, FIRST_STEP);
    if (next) setStep(next);
  }, []);

  const recordHorse = useCallback(
    (created: ChevalSortie) => {
      setHorse(created);
      advance();
    },
    [advance],
  );

  const goBack = useCallback(() => {
    const prev = prevStep(path, step);
    if (prev) setStep(prev);
  }, [path, step]);

  return {
    path,
    step,
    horse,
    done,
    progress: progressFor(path, step),
    canGoBack: canGoBackFor(path, step),
    choosePath,
    recordHorse,
    advance,
    goBack,
  };
}
