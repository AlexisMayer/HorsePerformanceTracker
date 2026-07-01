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

/**
 * Écriture refusée sur un cheval **archivé** (lot 4.3, Spec §9.2). Un cheval
 * archivé est **en lecture seule** : ni édition de fiche, ni saisie/édition de
 * séance (cohérent avec l'inviolabilité, Modèle §2). **409 Conflict** : la
 * requête entre en conflit avec l'**état** du cheval (archivé), pas avec les
 * droits du compte (403) ni son existence (404). Le `publicMessage` **dit quoi
 * faire** : désarchiver d'abord.
 */
export class ChevalArchivéError extends DomainError {
  readonly status = 409;
  readonly publicMessage =
    'Ce cheval est archivé (lecture seule). Désarchivez-le pour le modifier.';
  constructor() {
    super('Écriture refusée : le cheval est archivé (lecture seule, lot 4.3).');
  }
}
