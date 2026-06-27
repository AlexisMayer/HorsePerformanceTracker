import { Module } from '@nestjs/common';
import { AuthAccountModule } from './auth-account/auth-account.module';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, HealthModule, AuthAccountModule],
})
export class AppModule {}
