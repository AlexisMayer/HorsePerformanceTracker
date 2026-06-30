import { describe, expect, it } from 'vitest';
import {
  canGoBack,
  defaultPath,
  horseIsCreated,
  isLastStep,
  nextStep,
  prevStep,
  progress,
  shouldEnterOnboarding,
  stepsFor,
} from './onboarding-flow';

describe('defaultPath', () => {
  it('oriente le coach vers le chemin coach, le reste vers le cavalier', () => {
    expect(defaultPath('coach')).toBe('coach');
    expect(defaultPath('amateur')).toBe('cavalier');
  });
});

describe('stepsFor', () => {
  it('insère l’aperçu de bilan uniquement sur le chemin coach (Spec §2.3)', () => {
    expect(stepsFor('cavalier')).not.toContain('bilan-demo');
    expect(stepsFor('coach')).toContain('bilan-demo');
  });

  it('partage les trois étapes de configuration (cheval → ligne → séance)', () => {
    for (const path of ['cavalier', 'coach'] as const) {
      const steps = stepsFor(path);
      expect(steps[0]).toBe('bifurcation');
      expect(steps.at(-1)).toBe('guided-session');
      expect(steps).toContain('horse');
      expect(steps).toContain('starting-line');
    }
  });
});

describe('nextStep / prevStep', () => {
  it('avance le long du chemin cavalier (court)', () => {
    expect(nextStep('cavalier', 'bifurcation')).toBe('horse');
    expect(nextStep('cavalier', 'horse')).toBe('starting-line');
    expect(nextStep('cavalier', 'starting-line')).toBe('guided-session');
    expect(nextStep('cavalier', 'guided-session')).toBeNull(); // fin → feed
  });

  it('insère bilan-demo entre bifurcation et cheval sur le chemin coach', () => {
    expect(nextStep('coach', 'bifurcation')).toBe('bilan-demo');
    expect(nextStep('coach', 'bilan-demo')).toBe('horse');
  });

  it('recule symétriquement ; null au tout début', () => {
    expect(prevStep('coach', 'horse')).toBe('bilan-demo');
    expect(prevStep('cavalier', 'horse')).toBe('bifurcation');
    expect(prevStep('cavalier', 'bifurcation')).toBeNull();
  });
});

describe('isLastStep', () => {
  it('la séance guidée est la dernière étape des deux chemins', () => {
    expect(isLastStep('cavalier', 'guided-session')).toBe(true);
    expect(isLastStep('coach', 'guided-session')).toBe(true);
    expect(isLastStep('cavalier', 'starting-line')).toBe(false);
  });
});

describe('progress (hors bifurcation)', () => {
  it('compte 3 étapes pour le cavalier, 4 pour le coach', () => {
    expect(progress('cavalier', 'bifurcation')).toEqual({ current: 0, total: 3 });
    expect(progress('coach', 'bifurcation')).toEqual({ current: 0, total: 4 });
  });

  it('numérote l’étape courante (la bifurcation ne compte pas)', () => {
    expect(progress('cavalier', 'horse')).toEqual({ current: 1, total: 3 });
    expect(progress('cavalier', 'guided-session')).toEqual({ current: 3, total: 3 });
    expect(progress('coach', 'horse')).toEqual({ current: 2, total: 4 });
  });
});

describe('horseIsCreated / canGoBack', () => {
  it('marque le cheval comme créé dès la ligne de départ', () => {
    expect(horseIsCreated('horse')).toBe(false);
    expect(horseIsCreated('starting-line')).toBe(true);
    expect(horseIsCreated('guided-session')).toBe(true);
  });

  it('autorise le retour avant le cheval, l’interdit après (pas de second cheval)', () => {
    expect(canGoBack('cavalier', 'bifurcation')).toBe(false); // entrée
    expect(canGoBack('cavalier', 'horse')).toBe(true);
    expect(canGoBack('coach', 'bilan-demo')).toBe(true);
    expect(canGoBack('cavalier', 'starting-line')).toBe(false); // cheval posé
    expect(canGoBack('coach', 'guided-session')).toBe(false);
  });
});

describe('shouldEnterOnboarding (garde de navigation)', () => {
  const base = {
    authenticated: true,
    horsesLoading: false,
    horsesCount: 0,
    inOnboarding: false,
  };

  it('entre quand un utilisateur authentifié n’a aucun cheval', () => {
    expect(shouldEnterOnboarding(base)).toBe(true);
  });

  it('n’entre pas tant que la liste des chevaux charge (pas de clignotement)', () => {
    expect(shouldEnterOnboarding({ ...base, horsesLoading: true })).toBe(false);
  });

  it('n’entre pas s’il a déjà un cheval', () => {
    expect(shouldEnterOnboarding({ ...base, horsesCount: 1 })).toBe(false);
  });

  it('n’entre pas si on y est déjà (jamais de boucle)', () => {
    expect(shouldEnterOnboarding({ ...base, inOnboarding: true })).toBe(false);
  });

  it('n’entre pas si non authentifié', () => {
    expect(shouldEnterOnboarding({ ...base, authenticated: false })).toBe(false);
  });
});
