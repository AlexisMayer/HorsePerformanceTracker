import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
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
 *  - `EntitlementsModule` → `EntitlementGuard` (garde `analytique_diagnostic`, 4.1) ;
 *  - `PassportModule`     → stratégie `jwt-access` de la garde d'auth (1.1).
 *
 * `analytics` n'a **ni table, ni écriture** métier (la heatmap est une
 * lecture/composition) : la propriété/404 vient de `sessions`/`horses`.
 *
 * `AnalyticsService` est **exporté** : le lot **4.6** (comptes invité) le
 * consommera pour **relire la heatmap en lecture seule scopée** — via le service
 * exposé, sans recalcul (Architecture §2/§3). Le lot **5.2** (benchmark)
 * étendra ce module (endpoint frère sous la même garde).
 */
@Module({
  imports: [PassportModule, EntitlementsModule, SessionsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
