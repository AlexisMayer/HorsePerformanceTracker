import {
  type BilanProgression,
  type BilanProgressionParams,
  bilanProgressionParamsSchema,
} from '@hpt/shared';
import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { RequireCapacité } from '../entitlements/require-capacite.decorator';
import { ProgressionReportService } from './progression-report.service';

/**
 * Frontière HTTP du module `progression-report` (lot 4.4, Architecture §5). Route
 * orientée ressource, **authentifiée** (`JwtAccessGuard` de 1.1), **scopée au
 * compte courant** (le cheval vient de l'URL ; propriété vérifiée → 404 sans fuite)
 * et **gatée premium/pro** (§8).
 *
 * **Garde d'entitlement (4.1) attachée ici** — c'est ce que 4.1 annonçait
 * (« les fonctions payantes 4.4+ l'attacheront ») : `@RequireCapacité('bilan_
 * progression')` + `EntitlementGuard`, **après** `JwtAccessGuard`. Un compte
 * **gratuit** est refusé en **403** (`CapacitéRequiseError`), l'UI ne fait que
 * griser (4.2). Le `:id` malformé est rejeté en **400** par `ParseUUIDPipe`.
 *
 * **POST** (pas GET) : générer un bilan est une **action** qui **produit un
 * artefact** (rendu HTML → sortie fichier/URL présignée, Stack §5) et porte un
 * corps de **curation** (période + indicateurs, §6.3). La génération n'écrit
 * néanmoins **aucune** donnée métier (inviolabilité §2) : elle compose et rend.
 */
@Controller()
@UseGuards(JwtAccessGuard, EntitlementGuard)
@RequireCapacité('bilan_progression')
export class ProgressionReportController {
  constructor(private readonly reports: ProgressionReportService) {}

  /**
   * Génère le bilan de progression d'un cheval du compte courant. Le corps
   * (**optionnel**, tout par défaut) porte la **curation** : `période` (fenêtre
   * documentée), `indicateurs` (sections affichées) et `format` (`lien`/`pdf`).
   * 403 si le tier ne débloque pas `bilan_progression` ; 404 si cheval étranger.
   */
  @Post('horses/:id/progression-report')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Body(new ZodValidationPipe(bilanProgressionParamsSchema)) params: BilanProgressionParams,
  ): Promise<BilanProgression> {
    return this.reports.generate(user.id, chevalId, params);
  }
}
