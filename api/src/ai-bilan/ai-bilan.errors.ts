import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine du module `ai-bilan` (lot 4.5, Architecture §5). Traduites
 * en réponse HTTP par le `DomainExceptionFilter` global (1.1) — le client ne
 * reçoit que le code + le `publicMessage`, jamais d'interne.
 */

/**
 * Aucun bilan augmenté n'existe pour cette séance (relecture d'une séance qui
 * n'en a pas). **404** : le bilan est **relu sans régénération** (Spec §7.3) ;
 * s'il n'a jamais été généré, il n'y a rien à relire (l'app propose alors de le
 * générer). La **propriété** de la séance est déjà vérifiée en amont via
 * `sessions` (404 sans fuite si étrangère).
 */
export class BilanAugmentéNotFoundError extends DomainError {
  readonly status = 404;
  readonly publicMessage = 'Aucun bilan augmenté pour cette séance.';
  constructor() {
    super('Aucun bilan augmenté persisté pour cette séance.');
  }
}

/**
 * L'utilisateur a dépassé son plafond de **générations** IA sur la fenêtre
 * glissante (rate limiting + garde-fou de coût, Stack §3.6). **429** : la
 * relecture reste possible (elle ne consomme rien) ; seule une **nouvelle**
 * génération est temporairement refusée.
 */
export class BilanAugmentéRateLimitError extends DomainError {
  readonly status = 429;
  readonly publicMessage = 'Trop de bilans augmentés générés récemment. Réessaie un peu plus tard.';
  constructor() {
    super('Rate limit de génération de bilan augmenté dépassé pour ce compte.');
  }
}
