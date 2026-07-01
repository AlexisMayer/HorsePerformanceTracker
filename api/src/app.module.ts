import { Module } from '@nestjs/common';
import { AiBilanModule } from './ai-bilan/ai-bilan.module';
import { AuthAccountModule } from './auth-account/auth-account.module';
import { CombinationsModule } from './combinations/combinations.module';
import { DatabaseModule } from './db/database.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { FeedModule } from './feed/feed.module';
import { HealthModule } from './health/health.module';
import { HorsesModule } from './horses/horses.module';
import { MetricsModule } from './metrics/metrics.module';
import { ProgressionReportModule } from './progression-report/progression-report.module';
import { SessionsModule } from './sessions/sessions.module';
import { SharingModule } from './sharing/sharing.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    AuthAccountModule,
    EntitlementsModule,
    HorsesModule,
    CombinationsModule,
    SessionsModule,
    FeedModule,
    MetricsModule,
    SharingModule,
    ProgressionReportModule,
    AiBilanModule,
  ],
})
export class AppModule {}
