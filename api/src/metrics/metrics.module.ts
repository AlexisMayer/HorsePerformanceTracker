import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SessionsModule } from '../sessions/sessions.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Module `metrics` (lot 3.2, Architecture §3 : **composition des graphes héros** —
 * **dépend de `sessions`**). `PassportModule` est importé pour que
 * `JwtAccessGuard` (stratégie `jwt-access` enregistrée par `auth-account`)
 * protège la route ; `SessionsModule` est importé pour consommer
 * `SessionsService` (lecture de l'historique d'un cheval **via son service
 * exposé**, jamais ses tables — Architecture §1/§3), exactement comme `feed` (3.1).
 *
 * `metrics` est une surface de **lecture** : il n'a ni table, ni écriture, ni
 * erreur de domaine propre (la propriété/404 vient de `sessions`/`horses`). Tout
 * le **calcul** vit dans `shared` (hauteur maîtrisée §10, détection record/jalon
 * de 3.1) ; ce module ne fait qu'**orchestrer** (Architecture §2).
 *
 * `MetricsService` est **exporté** (lot 4.4) : le module `progression-report`
 * (bilan de progression) le consomme pour **réutiliser** la hauteur maîtrisée +
 * sa courbe — via le service exposé, sans recalcul (Architecture §2/§3).
 */
@Module({
  imports: [PassportModule, SessionsModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
