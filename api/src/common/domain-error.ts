/**
 * Erreur de **domaine** typée (Architecture §5). Le service de domaine lève ces
 * erreurs sans connaître HTTP ; un filtre (`DomainExceptionFilter`) les traduit
 * en réponse. `message` est interne (journalisé côté serveur) ; `publicMessage`
 * est ce que voit le client — **aucune fuite d'interne**.
 */
export abstract class DomainError extends Error {
  /** Code HTTP à exposer pour cette erreur. */
  abstract readonly status: number;
  /** Message sobre destiné au client (sans jargon ni détail interne). */
  abstract readonly publicMessage: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
