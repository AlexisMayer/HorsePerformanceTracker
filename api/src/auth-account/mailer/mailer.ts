/**
 * Port `Mailer` (lot 1.2) — **seam** d'envoi d'e-mails transactionnels. En dev,
 * une implémentation **stub console/log** (`ConsoleMailer`) ; en prod,
 * l'implémentation **Scaleway TEM** se branchera derrière ce même port (Stack
 * §3.5) — **différée, hors lot 1.2**. C'est ce port qui permet de la poser plus
 * tard sans toucher au domaine.
 *
 * Décision tranchée : un port **étroit**, une méthode par e-mail transactionnel
 * (vérification, reset). Pas de moteur de templates ni d'abstraction de
 * transport générique (pas d'abstraction prématurée — Architecture §7). Quand
 * TEM arrive, on ajoute une classe qui implémente cette interface et on permute
 * le provider dans le module.
 */

/** Message d'e-mail transactionnel : destinataire + lien d'action. */
export interface MailMessage {
  /** Adresse e-mail du destinataire. */
  to: string;
  /** Lien d'action (vérification ou réinitialisation), jeton inclus. */
  link: string;
}

export interface Mailer {
  /** Envoie le lien de **vérification d'e-mail**. */
  sendEmailVerification(message: MailMessage): Promise<void>;
  /** Envoie le lien de **réinitialisation de mot de passe**. */
  sendPasswordReset(message: MailMessage): Promise<void>;
}

/** Jeton d'injection du port `Mailer`. */
export const MAILER = Symbol('MAILER');
