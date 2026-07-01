import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPendingInvite,
  getPendingInvite,
  setPendingInvite,
  takePendingInvite,
} from './pending-invite';

afterEach(() => clearPendingInvite());

describe('pending-invite — jeton en attente (onboarding invité par deep link, lot 4.6)', () => {
  it('null par défaut', () => {
    expect(getPendingInvite()).toBeNull();
  });

  it('set puis get renvoie le jeton (sans le consommer)', () => {
    setPendingInvite('jeton-1');
    expect(getPendingInvite()).toBe('jeton-1');
    expect(getPendingInvite()).toBe('jeton-1');
  });

  it('take renvoie le jeton **et** le vide (usage unique → pas de double acceptation)', () => {
    setPendingInvite('jeton-2');
    expect(takePendingInvite()).toBe('jeton-2');
    expect(takePendingInvite()).toBeNull();
    expect(getPendingInvite()).toBeNull();
  });

  it('clear vide le jeton en attente', () => {
    setPendingInvite('jeton-3');
    clearPendingInvite();
    expect(getPendingInvite()).toBeNull();
  });
});
