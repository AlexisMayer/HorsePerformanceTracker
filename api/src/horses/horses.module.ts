import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { HorsesController } from './horses.controller';
import { HorsesService } from './horses.service';

/**
 * Module `horses` (lot 2.1, Architecture §3 : fiche cheval CRUD — **dépend de
 * `auth-account`**). La connexion DB est fournie par le `DatabaseModule`
 * `@Global` (lot 1.1) ; `PassportModule` est importé pour que `JwtAccessGuard`
 * (stratégie `jwt-access` enregistrée par `auth-account`) protège les routes.
 * Le `DomainExceptionFilter` global (posé par `auth-account`) traduit
 * `ChevalNotFoundError` en réponse HTTP.
 */
@Module({
  imports: [PassportModule],
  controllers: [HorsesController],
  providers: [HorsesService],
})
export class HorsesModule {}
