import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine du module `sessions` (Architecture §5).
 */

/**
 * Séance introuvable **ou** rattachée à un cheval qui n'appartient pas au compte
 * courant. **404 volontaire** dans les deux cas : une séance d'un autre compte se
 * comporte comme si elle n'existait pas — aucune **fuite d'existence** (un 403
 * révélerait qu'elle existe). Même posture que `ChevalNotFoundError` (lot 2.1) :
 * la propriété est vérifiée via le service `horses`, pas en lisant ses tables.
 */
export class SéanceNotFoundError extends DomainError {
  readonly status = 404;
  readonly publicMessage = 'Séance introuvable.';
  constructor() {
    super('Séance introuvable ou n’appartenant pas au compte courant.');
  }
}
