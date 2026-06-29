import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CombinationsModule } from '../combinations/combinations.module';
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
 *
 * **`CombinationsModule` importé (lot 2.5)** : à l'instanciation d'un obstacle
 * Combinaison portant une `combinaison_ref`, le service consomme
 * `CombinationsService` pour **valider la propriété** de la ref (404 sinon),
 * **copier `nombre_d_éléments`** inline et **enregistrer l'usage** — via le
 * service exposé, jamais en lisant la table `combinaison` (Architecture §1).
 *
 * **`SessionsService` exporté (lot 3.1)** : le module `feed` le consomme pour
 * **lire** l'historique d'un cheval (`listForHorse`) et composer le fil — un
 * domaine en consomme un autre via son service exposé, jamais ses tables
 * (Architecture §1/§3). `sessions` reste le gardien de l'écriture ; `feed` ne
 * fait que lire.
 */
@Module({
  imports: [PassportModule, HorsesModule, CombinationsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
