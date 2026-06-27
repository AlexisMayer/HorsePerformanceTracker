import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from './domain-error';

/**
 * Traduit toute `DomainError` en réponse HTTP (Architecture §5). Le détail
 * interne est **journalisé** côté serveur ; le client ne reçoit que le code et
 * le `publicMessage` — jamais de stack ni de message d'implémentation.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.warn(`${error.name}: ${error.message}`);
    response.status(error.status).json({ statusCode: error.status, message: error.publicMessage });
  }
}
