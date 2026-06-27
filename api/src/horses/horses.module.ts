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
 *
 * `HorsesService` est **exporté** : le module `sessions` (lot 2.2) le consomme
 * pour vérifier la propriété du cheval à chaque écriture/lecture de séance — un
 * domaine en consomme un autre via son service exposé, jamais ses tables
 * (Architecture §1).
 */
@Module({
  imports: [PassportModule],
  controllers: [HorsesController],
  providers: [HorsesService],
  exports: [HorsesService],
})
export class HorsesModule {}
