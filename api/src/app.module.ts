import { Module } from '@nestjs/common';
import { AuthAccountModule } from './auth-account/auth-account.module';
import { CombinationsModule } from './combinations/combinations.module';
import { DatabaseModule } from './db/database.module';
import { FeedModule } from './feed/feed.module';
import { HealthModule } from './health/health.module';
import { HorsesModule } from './horses/horses.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    AuthAccountModule,
    HorsesModule,
    CombinationsModule,
    SessionsModule,
    FeedModule,
  ],
})
export class AppModule {}
