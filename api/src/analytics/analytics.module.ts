import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CombinationsModule } from '../combinations/combinations.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Module `analytics` (lot 5.1, Architecture §3 : **diagnostic premium** — dépend
 * de `sessions` et de la garde d'`entitlements`). Il **compose** via les services
 * exposés (jamais leurs tables, §1/§3) et **ne recalcule rien** (§2) — tout le
 * calcul (heatmap type × hauteur, qui réutilise le taux §7) vit dans `shared` :
 *
 *  - `SessionsModule`     → `SessionsService` (historique brut d'un cheval) ;
 *  - `CombinationsModule` → `CombinationsService` (identité/propriété d'une
 *    réutilisable, pour le **benchmark** 5.2) ;
 *  - `EntitlementsModule` → `EntitlementGuard` (garde `analytique_diagnostic`, 4.1) ;
 *  - `PassportModule`     → stratégie `jwt-access` de la garde d'auth (1.1).
 *
 * `analytics` n'a **ni table, ni écriture** métier (heatmap/benchmark sont de la
 * lecture/composition) : la propriété/404 vient de `sessions`/`combinations`.
 * Dépendances **orientées** `analytics → sessions/combinations` (pas de cycle :
 * `sessions → combinations → entitlements`).
 *
 * `AnalyticsService` est **exporté** : le lot **4.6** (comptes invité) le consomme
 * pour **relire l'analytique en lecture seule scopée** — heatmap (5.1) **et**
 * benchmark (5.2) — via le service exposé, sans recalcul (Architecture §2/§3).
 */
@Module({
  imports: [PassportModule, EntitlementsModule, SessionsModule, CombinationsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
