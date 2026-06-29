import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CombinationsController } from './combinations.controller';
import { CombinationsService } from './combinations.service';

/**
 * Module `combinations` (lot 2.5, Architecture §3 : bibliothèque réutilisable —
 * **dépend de `auth-account`**). La connexion DB vient du `DatabaseModule`
 * `@Global` (1.1) ; `PassportModule` est importé pour que `JwtAccessGuard`
 * (stratégie `jwt-access` enregistrée par `auth-account`) protège les routes. Le
 * `DomainExceptionFilter` global (posé par `auth-account`) traduit
 * `CombinaisonNotFoundError` / `CombinaisonInvalideError` en réponse HTTP.
 *
 * `CombinationsService` est **exporté** : le module `sessions` (lot 2.2/2.5) le
 * consomme pour **valider** une `combinaison_ref` à l'instanciation et
 * **enregistrer l'usage** — un domaine en consomme un autre via son service
 * exposé, jamais ses tables (Architecture §1).
 */
@Module({
  imports: [PassportModule],
  controllers: [CombinationsController],
  providers: [CombinationsService],
  exports: [CombinationsService],
})
export class CombinationsModule {}
