import type { Capacité, CléQuota } from '@hpt/shared';
import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine du module `entitlements` (lot 4.1, Architecture §5). Le
 * gating est l'**autorité serveur** : ces erreurs traduisent un refus du serveur
 * en réponse HTTP via le `DomainExceptionFilter`. Le `publicMessage` **dit quoi
 * faire** (passer à un forfait supérieur) sans jargon — l'app (4.2) s'en sert
 * pour déclencher le flux d'upgrade.
 *
 * **403 Forbidden** (et non 401) : l'utilisateur est authentifié, mais son tier
 * ne lui ouvre pas la fonction/la ressource demandée.
 */

const MESSAGES_CAPACITÉ: Record<Capacité, string> = {
  analytique_diagnostic: 'L’analytique de diagnostic est réservée aux forfaits Premium et Pro.',
  bilan_augmenté: 'Le bilan augmenté par l’IA est réservé aux forfaits Premium et Pro.',
  bilan_progression: 'Le bilan de progression est réservé aux forfaits Premium et Pro.',
  multi_chevaux: 'Le suivi de plusieurs chevaux est réservé au forfait Pro.',
  comptes_invité: 'Les comptes invité sont réservés au forfait Pro.',
};

const MESSAGES_QUOTA: Record<CléQuota, string> = {
  chevaux: 'Limite de chevaux atteinte. Passez au forfait Pro pour suivre plusieurs chevaux.',
  combinaisons:
    'Limite de combinaisons réutilisables atteinte. Passez à Premium ou Pro pour une bibliothèque illimitée.',
};

/**
 * Le tier du principal n'ouvre pas la **capacité** demandée (garde
 * d'entitlement sur un endpoint premium/pro). Levée par `EntitlementGuard`.
 */
export class CapacitéRequiseError extends DomainError {
  readonly status = 403;
  readonly publicMessage: string;
  constructor(capacité: Capacité) {
    super(`Capacité non accordée par le tier : ${capacité}.`);
    this.publicMessage = MESSAGES_CAPACITÉ[capacité];
  }
}

/**
 * Le tier du principal a atteint son **plafond** pour une ressource (enforcement
 * de quota à la création). Levée à la création d'un cheval (multi-chevaux = pro)
 * ou d'une combinaison réutilisable au-delà du plafond gratuit (Spec §4.4/§8).
 */
export class QuotaDépasséError extends DomainError {
  readonly status = 403;
  readonly publicMessage: string;
  constructor(clé: CléQuota, plafond: number | null) {
    super(`Quota dépassé pour « ${clé} » (plafond : ${plafond ?? '∞'}).`);
    this.publicMessage = MESSAGES_QUOTA[clé];
  }
}
