import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine du module `horses` (Architecture §5).
 */

/**
 * Cheval introuvable **ou** n'appartenant pas au compte courant. **404
 * volontaire** dans les deux cas : un cheval d'un autre compte se comporte comme
 * s'il n'existait pas — aucune **fuite d'existence** (un 403 révélerait qu'il
 * existe). Le scoping au compte est appliqué dans la requête SQL elle-même
 * (clause `compte_id = …`), pas après coup.
 */
export class ChevalNotFoundError extends DomainError {
  readonly status = 404;
  readonly publicMessage = 'Cheval introuvable.';
  constructor() {
    super('Cheval introuvable ou n’appartenant pas au compte courant.');
  }
}
