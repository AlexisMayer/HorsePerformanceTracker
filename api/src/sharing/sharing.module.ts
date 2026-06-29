import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SessionsModule } from '../sessions/sessions.module';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

/**
 * Module `sharing` (lot 3.3, Architecture §3 : **composition des cartes
 * partageables** — bilan de séance simple). `PassportModule` est importé pour que
 * `JwtAccessGuard` protège la route ; `SessionsModule` est importé pour consommer
 * `SessionsService` (lecture de la séance + de l'historique d'un cheval **via son
 * service exposé**, jamais ses tables — Architecture §1/§3), exactement comme
 * `feed` (3.1) et `metrics` (3.2).
 *
 * `sharing` est une surface de **lecture** : il n'a ni table, ni écriture, ni
 * erreur de domaine propre (la propriété/404 vient de `sessions`/`horses`). Tout
 * le **calcul** vit dans `shared` (récap `résuméCarte` §7/§9, détection record/
 * jalon de 3.1 réutilisée par `metrics` 3.2) ; ce module ne fait qu'**orchestrer**
 * (Architecture §2). La carte simple est **gratuite** — hors gating (4.1, §8).
 */
@Module({
  imports: [PassportModule, SessionsModule],
  controllers: [SharingController],
  providers: [SharingService],
})
export class SharingModule {}
