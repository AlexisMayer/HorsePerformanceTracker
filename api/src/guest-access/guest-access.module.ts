import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ConsoleMailer } from '../auth-account/mailer/console-mailer';
import { MAILER } from '../auth-account/mailer/mailer';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { FeedModule } from '../feed/feed.module';
import { HorsesModule } from '../horses/horses.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SessionsModule } from '../sessions/sessions.module';
import { GuestAccessController } from './guest-access.controller';
import { GuestAccessService } from './guest-access.service';
import { GuestConsultationController } from './guest-consultation.controller';

/**
 * Module `guest-access` (lot 4.6, Architecture §3 : **invitations + autorisation
 * lecture seule scopée à un cheval** — dépend de `horses`, `feed`, `metrics`,
 * `analytics`, `entitlements`). Il **compose** via les services exposés (jamais
 * leurs tables, §1/§3) et **ne recalcule/refait aucune** surface (§2) :
 *
 *  - `HorsesModule`       → `HorsesService` (propriété du cheval, fiche partagée) ;
 *  - `FeedModule`         → `FeedService` (fil, exporté pour 4.6) ;
 *  - `MetricsModule`      → `MetricsService` (héros) ;
 *  - `SessionsModule`     → `SessionsService` (historique paginé) ;
 *  - `AnalyticsModule`    → `AnalyticsService` (heatmap) ;
 *  - `EntitlementsModule` → `EntitlementGuard` (garde `comptes_invité`, 4.1 — pro) ;
 *  - `PassportModule`     → stratégie `jwt-access` de la garde d'auth (1.1).
 *
 * **Seule table** du module : `acces_invite` (l'octroi ; `DatabaseModule` est
 * `@Global`). Le port **`Mailer`** est lié localement à `ConsoleMailer` (stub dev,
 * log) — en prod on permute l'implémentation TEM (Stack §3.5) sans toucher au
 * domaine, même seam que l'auth (1.2). Le `DomainExceptionFilter` global (1.1)
 * traduit les erreurs (`AccèsInvitéNotFoundError` 404, `InvitationInvalideError`
 * 400, `AccèsInvitéDéjàExistantError` 409, et la `CapacitéRequiseError` 403 de la
 * garde pro).
 */
@Module({
  imports: [
    PassportModule,
    EntitlementsModule,
    HorsesModule,
    FeedModule,
    MetricsModule,
    SessionsModule,
    AnalyticsModule,
  ],
  controllers: [GuestAccessController, GuestConsultationController],
  providers: [GuestAccessService, { provide: MAILER, useClass: ConsoleMailer }],
})
export class GuestAccessModule {}
