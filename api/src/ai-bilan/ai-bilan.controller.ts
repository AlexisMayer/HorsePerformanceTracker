import type { BilanAugmentéSortie, BilansAugmentésDisponibles } from '@hpt/shared';
import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { RequireCapacité } from '../entitlements/require-capacite.decorator';
import { AiBilanService } from './ai-bilan.service';

/**
 * Frontière HTTP du module `ai-bilan` (lot 4.5, Architecture §5). Routes
 * orientées ressource, **authentifiées** (`JwtAccessGuard`, 1.1), **scopées au
 * compte courant** (la séance/le cheval viennent de l'URL ; propriété vérifiée
 * via `sessions` → 404 sans fuite) et **gatées premium/pro** (§8).
 *
 * **Garde d'entitlement (4.1) attachée ici** — c'est ce que 4.1 annonçait
 * (« les fonctions payantes 4.4+ l'attacheront ») : `@RequireCapacité('bilan_
 * augmenté')` + `EntitlementGuard`, **après** `JwtAccessGuard`. Un compte
 * **gratuit** (et l'invité 4.6) est refusé en **403** (`CapacitéRequiseError`) ;
 * l'UI ne fait que griser (verrou 4.2). `:id` malformé → **400** (`ParseUUIDPipe`).
 *
 * - **POST** `/sessions/:id/ai-bilan` — génère **à la demande** (Spec §7.1) ;
 *   get-or-create (relu sans régénération si déjà présent), rate-limité.
 * - **GET** `/sessions/:id/ai-bilan` — **relit** le bilan persisté (Spec §7.3),
 *   **jamais** d'appel IA (404 si aucun).
 * - **GET** `/horses/:id/ai-bilan` — **disponibilité** (séances avec bilan) pour
 *   remplir le **slot ✦** de l'Historique (3.4).
 */
@Controller()
@UseGuards(JwtAccessGuard, EntitlementGuard)
@RequireCapacité('bilan_augmenté')
export class AiBilanController {
  constructor(private readonly aiBilan: AiBilanService) {}

  /** Génère (à la demande) le bilan augmenté d'une séance du compte courant. */
  @Post('sessions/:id/ai-bilan')
  générer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
  ): Promise<BilanAugmentéSortie> {
    return this.aiBilan.générer(user.id, seanceId);
  }

  /** Relit le bilan augmenté persisté (aucun appel IA ; 404 si aucun). */
  @Get('sessions/:id/ai-bilan')
  relire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
  ): Promise<BilanAugmentéSortie> {
    return this.aiBilan.relire(user.id, seanceId);
  }

  /** Séances d'un cheval du compte courant qui possèdent un bilan augmenté (✦). */
  @Get('horses/:id/ai-bilan')
  disponibles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<BilansAugmentésDisponibles> {
    return this.aiBilan.disponibles(user.id, chevalId);
  }
}
