import { z } from 'zod';
import { hauteurSchema, niveauChevalSchema } from './referentiel';

/**
 * DTO d'**entrée** — création d'un cheval.
 *
 * `compte_id` n'est pas dans le corps : il est posé par le serveur depuis le
 * compte authentifié.
 */
export const chevalCréerSchema = z.object({
  nom: z.string().min(1).max(120),
  niveau: niveauChevalSchema,
  hauteur_de_référence: hauteurSchema,
  âge: z.number().int().positive().max(60).optional(),
  race: z.string().min(1).max(120).optional(),
});

export type ChevalCréerDto = z.infer<typeof chevalCréerSchema>;
