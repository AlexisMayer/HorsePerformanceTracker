import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SessionsModule } from '../sessions/sessions.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

/**
 * Module `feed` (lot 3.1, Architecture §3 : **composition du fil mono-cheval** —
 * **dépend de `sessions`**). `PassportModule` est importé pour que
 * `JwtAccessGuard` (stratégie `jwt-access` enregistrée par `auth-account`)
 * protège la route ; `SessionsModule` est importé pour consommer
 * `SessionsService` (lecture de l'historique d'un cheval **via son service
 * exposé**, jamais ses tables — Architecture §1/§3).
 *
 * Le `feed` est une surface de **lecture** : il n'a ni table, ni écriture, ni
 * erreur de domaine propre (la propriété/404 vient de `sessions`/`horses`). Tout
 * le **calcul** vit dans `shared` (faits §7/§9, jalons §10) ; ce module ne fait
 * qu'**orchestrer** (Architecture §2). Le module `metrics` (3.2) **réutilisera**
 * le même calcul `shared` pour la vitrine — pas de double implémentation.
 *
 * `FeedService` est **exporté** (lot 4.6) : le module `guest-access` le consomme
 * pour **relire le fil en lecture seule scopée** (invité), via le service exposé,
 * sans recomposer — comme il réutilise `metrics`/`analytics` (Architecture §2/§3).
 */
@Module({
  imports: [PassportModule, SessionsModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
