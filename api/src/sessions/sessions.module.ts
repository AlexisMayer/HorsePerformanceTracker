import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { HorsesModule } from '../horses/horses.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

/**
 * Module `sessions` (lot 2.2, Architecture §3 : **inviolabilité & horodatage** —
 * **dépend de `horses`**). La connexion DB vient du `DatabaseModule` `@Global`
 * (lot 1.1) ; `PassportModule` est importé pour que `JwtAccessGuard` (stratégie
 * `jwt-access` enregistrée par `auth-account`) protège les routes ; `HorsesModule`
 * est importé pour consommer `HorsesService` (vérification de la propriété du
 * cheval — jamais en lisant ses tables, Architecture §1). Le `DomainExceptionFilter`
 * global (posé par `auth-account`) traduit `SéanceNotFoundError` en réponse HTTP.
 */
@Module({
  imports: [PassportModule, HorsesModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
