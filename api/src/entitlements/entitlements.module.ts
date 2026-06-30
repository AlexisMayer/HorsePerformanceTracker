import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EntitlementGuard } from './entitlement.guard';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';

/**
 * Module `entitlements` (lot 4.1, Architecture §3 : **garde transverse** du
 * gating — **dépend de `auth-account`** pour l'identité/le tier du principal).
 * `PassportModule` est importé pour que `JwtAccessGuard` (stratégie `jwt-access`
 * enregistrée par `auth-account`) protège `GET /me/entitlement`. Le
 * `DomainExceptionFilter` global (posé par `auth-account`) traduit
 * `CapacitéRequiseError` / `QuotaDépasséError` en réponse HTTP (403).
 *
 * `EntitlementsService` **et** `EntitlementGuard` sont **exportés** :
 *  - `horses` (2.1) et `combinations` (2.5) consomment le **service** pour
 *    l'enforcement de quota à la création (décompte fourni par eux-mêmes) ;
 *  - les modules de fonctions payantes (4.4/4.5/4.6/5.1) attacheront la **garde**
 *    sur leurs endpoints premium/pro.
 *
 * `entitlements` ne dépend d'aucun module de ressource : le décompte traverse la
 * frontière dans l'autre sens (la ressource appelle le service), ce qui garde le
 * graphe acyclique.
 */
@Module({
  imports: [PassportModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, EntitlementGuard],
  exports: [EntitlementsService, EntitlementGuard],
})
export class EntitlementsModule {}
