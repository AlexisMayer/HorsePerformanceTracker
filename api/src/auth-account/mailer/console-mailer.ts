import { Injectable, Logger } from '@nestjs/common';
import type { Mailer, MailMessage } from './mailer';

/**
 * Implémentation **dev** du port `Mailer` (Setup roadmap : e-mails « stubés /
 * loggés » en dev). N'envoie rien : elle **journalise** le lien d'action via le
 * `Logger` Nest, de sorte qu'un développeur (ou un test) puisse le lire et le
 * suivre. En prod, `Mailer` est implémenté par Scaleway TEM (Stack §3.5,
 * différé). Aucune délivrabilité réelle ici.
 */
@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('Mailer');

  async sendEmailVerification({ to, link }: MailMessage): Promise<void> {
    this.logger.log(`[email-verification] → ${to} · lien : ${link}`);
  }

  async sendPasswordReset({ to, link }: MailMessage): Promise<void> {
    this.logger.log(`[password-reset] → ${to} · lien : ${link}`);
  }
}
