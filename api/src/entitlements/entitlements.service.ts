import {
  aLaCapacité,
  type Capacité,
  type CléQuota,
  type EntitlementSortie,
  entitlementPourTier,
  entitlementSortieSchema,
  peutCréer,
  quotaPour,
  type Tier,
} from '@hpt/shared';
import { Injectable } from '@nestjs/common';
import { CapacitéRequiseError, QuotaDépasséError } from './entitlements.errors';

/**
 * Service de domaine **`entitlements`** (lot 4.1, Architecture §3) — **autorité
 * serveur du gating** (§5). Il *interprète* le `tier` (référentiel posé en
 * 0.2/0.3 sur Compte, lu au login et porté par le **principal** JWT) à travers
 * la **politique de `@hpt/shared`** : capacités gatées + quotas. Une seule
 * implémentation, partagée avec l'app (grisage 4.2) — aucune règle de tier
 * dispersée dans les modules de domaine.
 *
 * Le service ne porte **aucun état ni accès base** : la capacité/le plafond
 * viennent de la matrice `shared` (pur) ; le **décompte** d'une ressource est
 * fourni par le module qui la possède (`horses`, `combinations`) — `entitlements`
 * ne lit jamais leurs tables (Architecture §1/§3). C'est ce qui garde les
 * dépendances orientées `horses/combinations → entitlements`, sans cycle.
 *
 * Source du `tier` : le **principal** (claim JWT signé par le serveur au login,
 * Spec §9.3). Il provient de `Compte.tier` et ne peut pas être forgé côté
 * client → autorité serveur. Un changement de tier (upgrade 4.2) se propage au
 * prochain rafraîchissement de jeton.
 */
@Injectable()
export class EntitlementsService {
  /**
   * Projette l'entitlement complet d'un tier (capacités + quotas), **validé** par
   * le schéma de sortie `shared` (Architecture §5). Exposé par `GET
   * /me/entitlement` ; l'app le lit au login (Spec §9.3) pour afficher le tier
   * et préparer le grisage (4.2).
   */
  entitlement(tier: Tier): EntitlementSortie {
    return entitlementSortieSchema.parse(entitlementPourTier(tier));
  }

  /**
   * **Garde de capacité** : lève `CapacitéRequiseError` (403) si le tier n'ouvre
   * pas la capacité gatée. Utilisée par `EntitlementGuard` (et appelable
   * directement par un service qui voudrait gater une opération hors HTTP).
   */
  assertCapacité(tier: Tier, capacité: Capacité): void {
    if (!aLaCapacité(tier, capacité)) {
      throw new CapacitéRequiseError(capacité);
    }
  }

  /**
   * **Enforcement de quota** : lève `QuotaDépasséError` (403) si, avec
   * `countActuel` ressources déjà présentes, en créer une de plus dépasserait le
   * plafond du tier. Le `countActuel` est fourni par le module propriétaire de la
   * ressource (décompte sur l'**actif** côté `horses`). Illimité ⇒ jamais levée.
   */
  assertPeutCréer(tier: Tier, clé: CléQuota, countActuel: number): void {
    if (!peutCréer(tier, clé, countActuel)) {
      throw new QuotaDépasséError(clé, quotaPour(tier, clé));
    }
  }
}
