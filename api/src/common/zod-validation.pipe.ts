import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valide une entrée contre un schéma Zod de `@hpt/shared` à la **frontière**
 * d'API (Architecture §5 : « rien n'entre non validé »). Renvoie la donnée
 * typée + nettoyée (clés inconnues retirées) ou lève un 400 listant les
 * problèmes — sans exposer d'interne.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Requête invalide.',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
