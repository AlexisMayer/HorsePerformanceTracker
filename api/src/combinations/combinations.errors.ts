import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine du module `combinations` (Architecture §5).
 */

/**
 * Combinaison réutilisable introuvable **ou** n'appartenant pas au compte
 * courant. **404 volontaire** dans les deux cas : la réutilisable d'un autre
 * compte se comporte comme si elle n'existait pas — aucune **fuite d'existence**
 * (un 403 révélerait qu'elle existe). Même posture que `ChevalNotFoundError`
 * (2.1) / `SéanceNotFoundError` (2.2). Levée aussi quand `sessions` valide une
 * `combinaison_ref` étrangère à l'instanciation (Architecture §1 : via le service
 * exposé, jamais en lisant la table).
 */
export class CombinaisonNotFoundError extends DomainError {
  readonly status = 404;
  readonly publicMessage = 'Combinaison introuvable.';
  constructor() {
    super('Combinaison introuvable ou n’appartenant pas au compte courant.');
  }
}

/**
 * Structure incohérente à la dérivation d'une nouvelle combinaison (« édition »).
 * Survient quand on change `nombre_d_éléments` **sans** fournir une liste
 * `éléments` du même cardinal (la liste ordonnée **est** la structure ; on ne
 * peut pas inventer les types manquants). **400** — le client doit fournir la
 * structure complète.
 */
export class CombinaisonInvalideError extends DomainError {
  readonly status = 400;
  readonly publicMessage = 'Le nombre d’éléments et le détail des éléments doivent concorder.';
  constructor() {
    super('Cardinalité incohérente : nombre_d_éléments ≠ éléments.length à la dérivation.');
  }
}
