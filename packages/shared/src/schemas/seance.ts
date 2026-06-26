import { z } from 'zod';
import { contexteCréerSchema } from './contexte';
import { obstacleCréerSchema } from './obstacle';
import { provenanceSchema, typeSéanceSchema } from './referentiel';
import { tourCréerSchema } from './tour';

/**
 * DTO d'**entrée** — création d'une séance avec ses unités atomiques imbriquées
 * (Modèle §3/§4/§5).
 *
 * La `date` n'est pas fournie : le serveur l'horodate (intégrité, §2). Le type
 * pilote la structure, validé par `superRefine` :
 *  - `Concours` → des `tours`, jamais d'`obstacles` ;
 *  - entraînement (Plat/Gymnastique/Parcours) → des `obstacles`, jamais de
 *    `tours` (un `Plat` peut avoir 0 obstacle : fréquence/régularité seulement).
 */
export const séanceCréerSchema = z
  .object({
    cheval_id: z.string().uuid(),
    type: typeSéanceSchema,
    provenance: provenanceSchema.default('live'),
    obstacles: z.array(obstacleCréerSchema).optional(),
    tours: z.array(tourCréerSchema).optional(),
    contexte: contexteCréerSchema.optional(),
  })
  .superRefine((s, ctx) => {
    if (s.type === 'Concours') {
      if (s.obstacles && s.obstacles.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['obstacles'],
          message: 'Un concours est une collection de tours, pas d’obstacles.',
        });
      }
    } else if (s.tours && s.tours.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tours'],
        message: 'Un entraînement est une collection d’obstacles, pas de tours.',
      });
    }
  });

export type SéanceCréerDto = z.infer<typeof séanceCréerSchema>;
