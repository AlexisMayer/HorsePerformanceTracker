import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../auth-account/current-user.decorator';
import { EntitlementGuard } from './entitlement.guard';
import { CapacitéRequiseError } from './entitlements.errors';
import { EntitlementsService } from './entitlements.service';
import { RequireCapacité } from './require-capacite.decorator';

/**
 * **Preuve (a) de la DoD du lot 4.1** : la garde d'entitlement **refuse un
 * principal sous-tier** sur un handler protégé représentatif — *côté serveur*,
 * sans dépendre de l'UI. Test **unitaire** (pas de base, pas de HTTP réel) : on
 * exerce la garde sur un contrôleur factice décoré comme le feront les modules
 * payants (4.4/4.5/4.6/5.1).
 */

/** Handler représentatif : une analytique de diagnostic, réservée premium/pro (§8). */
class AnalytiqueController {
  @RequireCapacité('analytique_diagnostic')
  heatmap(): string {
    return 'ok';
  }

  /** Endpoint non gaté (ex. boucle gratuite) — la garde ne doit pas le bloquer. */
  libre(): string {
    return 'ok';
  }
}

/** Construit un `ExecutionContext` minimal pointant un handler + un principal. */
function contextePour(handler: (...args: unknown[]) => unknown, user: unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => AnalytiqueController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const principal = (tier: AuthenticatedUser['tier']): AuthenticatedUser => ({
  id: 'compte-1',
  email: 'a@hpt.test',
  type: 'amateur',
  tier,
});

describe('EntitlementGuard (garde réutilisable premium/pro)', () => {
  let guard: EntitlementGuard;

  beforeEach(() => {
    guard = new EntitlementGuard(new Reflector(), new EntitlementsService());
  });

  it('REFUSE un gratuit sur un handler premium/pro (403, autorité serveur)', () => {
    const ctx = contextePour(AnalytiqueController.prototype.heatmap, principal('gratuit'));
    expect(() => guard.canActivate(ctx)).toThrowError(CapacitéRequiseError);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect((e as CapacitéRequiseError).status).toBe(403);
    }
  });

  it('autorise un premium et un pro sur le même handler', () => {
    for (const tier of ['premium', 'pro'] as const) {
      const ctx = contextePour(AnalytiqueController.prototype.heatmap, principal(tier));
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('laisse passer tous les tiers sur un handler non annoté (hors gating)', () => {
    for (const tier of ['gratuit', 'premium', 'pro'] as const) {
      const ctx = contextePour(AnalytiqueController.prototype.libre, principal(tier));
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('exige un principal (doit suivre JwtAccessGuard) → 401 sans utilisateur', () => {
    const ctx = contextePour(AnalytiqueController.prototype.heatmap, undefined);
    expect(() => guard.canActivate(ctx)).toThrowError(UnauthorizedException);
  });
});
