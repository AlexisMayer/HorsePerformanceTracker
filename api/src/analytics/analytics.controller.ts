import type { BenchmarkListeDto, BenchmarkSérieDto, HeatmapDto } from '@hpt/shared';
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { RequireCapacité } from '../entitlements/require-capacite.decorator';
import { AnalyticsService } from './analytics.service';

/**
 * Frontière HTTP du module `analytics` (lot 5.1, Architecture §5). Route orientée
 * ressource, **authentifiée** (`JwtAccessGuard` de 1.1), **scopée au compte
 * courant** (le cheval vient de l'URL ; propriété vérifiée par `sessions`/`horses`
 * → 404 sans fuite) et **gatée premium/pro** (§8).
 *
 * **Garde d'entitlement (4.1) attachée ici** — c'est ce que 4.1 annonçait
 * (« 5.1 attachera la garde `analytique_diagnostic` ») : `@RequireCapacité('
 * analytique_diagnostic')` + `EntitlementGuard`, **après** `JwtAccessGuard`. Un
 * compte **gratuit** est refusé en **403** (`CapacitéRequiseError`) — le gating
 * est **autorité serveur** ; l'app ne fait que **griser** + inviter à l'upgrade
 * (verrou 4.2). Le `:id` malformé est rejeté en **400** par `ParseUUIDPipe`.
 *
 * Surface de **lecture seule** : `analytics` ne compose que des dérivés (rien
 * n'est écrit). Le **benchmark à combinaison constante** (5.2) ajoute deux endpoints
 * **frères ici**, sous la **même** garde `analytique_diagnostic` (§8) : la **liste**
 * des combinaisons benchmarkables d'un cheval et la **série** d'une identité.
 */
@Controller()
@UseGuards(JwtAccessGuard, EntitlementGuard)
@RequireCapacité('analytique_diagnostic')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * **Heatmap type × hauteur** d'un cheval du compte courant (Spec §5.3, Modèle
   * §9) : cellules `(type, hauteur)` portant le **taux §7 exact agrégé**. 403 si
   * le tier ne débloque pas `analytique_diagnostic` ; 404 si cheval étranger.
   */
  @Get('horses/:id/heatmap')
  heatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<HeatmapDto> {
    return this.analytics.heatmap(user.id, chevalId);
  }

  /**
   * **Combinaisons benchmarkables** d'un cheval (5.2) : les réutilisables
   * **instanciées** pour ce cheval (le sélecteur du benchmark), triées par usage.
   * 403 si le tier ne débloque pas `analytique_diagnostic` ; 404 si cheval étranger.
   */
  @Get('horses/:id/benchmark')
  benchmarkList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<BenchmarkListeDto> {
    return this.analytics.benchmarkList(user.id, chevalId);
  }

  /**
   * **Série benchmark** d'une combinaison réutilisable **identifiée** pour un cheval
   * (5.2, Modèle §8/§9) : sa progression *like-for-like* dans le temps (points
   * `{ date, taux §7, hauteur }` + tendance). 403 si le tier ne débloque pas
   * `analytique_diagnostic` ; 404 si cheval **ou** combinaison étrangers au compte.
   */
  @Get('horses/:id/benchmark/:combinaisonRef')
  benchmarkSérie(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Param('combinaisonRef', ParseUUIDPipe) combinaisonRef: string,
  ): Promise<BenchmarkSérieDto> {
    return this.analytics.benchmarkSérie(user.id, chevalId, combinaisonRef);
  }
}
