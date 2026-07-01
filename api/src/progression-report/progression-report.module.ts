import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { HorsesModule } from '../horses/horses.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SessionsModule } from '../sessions/sessions.module';
import { BILAN_RENDER } from './bilan-render.port';
import { LocalBilanRender } from './local-bilan-render';
import { ProgressionReportController } from './progression-report.controller';
import { ProgressionReportService } from './progression-report.service';

/**
 * Module `progression-report` (lot 4.4, Architecture §3 : **bilan de progression
 * PDF/lien** — dépend de `metrics` et `sessions`). Il **compose** via les services
 * exposés (jamais leurs tables, §1/§3) et **ne recalcule rien** (§2) :
 *
 *  - `SessionsModule` → `SessionsService` (historique brut) ;
 *  - `MetricsModule`  → `MetricsService` (hauteur maîtrisée §10 + courbe, 3.2) ;
 *  - `HorsesModule`   → `HorsesService` (identité + garde de propriété) ;
 *  - `EntitlementsModule` → `EntitlementGuard` (garde `bilan_progression`, 4.1) ;
 *  - `PassportModule` → stratégie `jwt-access` de la garde d'auth.
 *
 * La **sortie** est fournie par le port `BILAN_RENDER` : en dev, `LocalBilanRender`
 * (HTML → fichier local `file://`, PDF en stub) ; en prod, un adaptateur
 * `HTML → PDF via Playwright → Object Storage/URL présignée` se branche **ici**
 * sans toucher au service — **différé infra**, non bloquant DoD (Stack §5).
 *
 * `progression-report` n'a **ni table, ni écriture** métier (la génération est une
 * lecture/composition) : la propriété/404 vient de `sessions`/`horses`.
 */
@Module({
  imports: [PassportModule, EntitlementsModule, HorsesModule, SessionsModule, MetricsModule],
  controllers: [ProgressionReportController],
  providers: [
    ProgressionReportService,
    // Port de rendu : local/stub en dev (défaut) ; l'adaptateur prod (Playwright +
    // Object Storage) se substitue ici par déploiement, sans changement de logique.
    { provide: BILAN_RENDER, useClass: LocalBilanRender },
  ],
})
export class ProgressionReportModule {}
