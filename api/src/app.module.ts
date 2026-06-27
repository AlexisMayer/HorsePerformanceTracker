import { Module } from '@nestjs/common';
import { AuthAccountModule } from './auth-account/auth-account.module';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { HorsesModule } from './horses/horses.module';

@Module({
  imports: [DatabaseModule, HealthModule, AuthAccountModule, HorsesModule],
})
export class AppModule {}
