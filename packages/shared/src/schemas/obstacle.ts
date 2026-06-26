import { z } from 'zod';
import {
  compteurFautesSchema,
  hauteurSchema,
  typeObstacleSchema,
  typeObstacleSimpleSchema,
  échelle1à5Schema,
} from './referentiel';

/**
 * DTO d'**entrée** — un obstacle d'entraînement (Modèle §6.1).
 *
 * Les champs de combinaison sont conditionnels (`type === 'Combinaison'`),
 * validés par `superRefine` :
 *  - une combinaison EXIGE `nombre_d_éléments` (≥ 2) ;
 *  - un obstacle simple REFUSE `nombre_d_éléments` / `éléments` ;
 *  - si le détail des `éléments` est fourni, sa longueur doit correspondre.
 */
export const obstacleCréerSchema = z
  .object({
    type: typeObstacleSchema,
    hauteur: hauteurSchema,
    répétitions: z.number().int().min(1).default(1),
    barres: compteurFautesSchema,
    refus: compteurFautesSchema,
    difficulté: échelle1à5Schema.optional(),
    nombre_d_éléments: z.number().int().min(2).optional(),
    éléments: z.array(typeObstacleSimpleSchema).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.type === 'Combinaison') {
      if (o.nombre_d_éléments === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nombre_d_éléments'],
          message: 'Une combinaison exige `nombre_d_éléments`.',
        });
      } else if (o.éléments !== undefined && o.éléments.length !== o.nombre_d_éléments) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['éléments'],
          message: 'Le détail des éléments doit correspondre à `nombre_d_éléments`.',
        });
      }
    } else {
      if (o.nombre_d_éléments !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nombre_d_éléments'],
          message: '`nombre_d_éléments` n’est valable que pour une combinaison.',
        });
      }
      if (o.éléments !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['éléments'],
          message: '`éléments` n’est valable que pour une combinaison.',
        });
      }
    }
  });

export type ObstacleCréerDto = z.infer<typeof obstacleCréerSchema>;
