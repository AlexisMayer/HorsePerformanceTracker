import { z } from 'zod';
import { champsTechniquesSortie } from './champs-techniques';
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
 * validés par `superRefine`. **Deux façons de saisir une combinaison** :
 *  - **inline** (2.3, sans `combinaison_ref`) : EXIGE `nombre_d_éléments` (≥ 2) ;
 *    `éléments` optionnel, mais si fourni sa longueur doit correspondre.
 *  - **instanciée** depuis une réutilisable (2.5, avec `combinaison_ref`) :
 *    « on ne saisit que la hauteur » (Modèle §8) → `nombre_d_éléments` et
 *    `éléments` sont **interdits dans le corps** (le serveur **copie**
 *    `nombre_d_éléments` depuis la réutilisable et **hérite** `éléments` via la
 *    ref — non dupliqués).
 * Un obstacle **simple** REFUSE les trois champs de combinaison.
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
    combinaison_ref: z.string().uuid().optional(),
  })
  .superRefine((o, ctx) => {
    if (o.type === 'Combinaison') {
      if (o.combinaison_ref !== undefined) {
        // Instanciation : la structure vient de la réutilisable (copiée/héritée
        // par le serveur), jamais du corps — on ne saisit que la hauteur.
        if (o.nombre_d_éléments !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['nombre_d_éléments'],
            message:
              'Avec `combinaison_ref`, `nombre_d_éléments` est copié depuis la réutilisable.',
          });
        }
        if (o.éléments !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['éléments'],
            message: 'Avec `combinaison_ref`, les `éléments` sont hérités de la réutilisable.',
          });
        }
      } else if (o.nombre_d_éléments === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nombre_d_éléments'],
          message: 'Une combinaison exige `nombre_d_éléments` (ou une `combinaison_ref`).',
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
      if (o.combinaison_ref !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['combinaison_ref'],
          message: '`combinaison_ref` n’est valable que pour une combinaison.',
        });
      }
    }
  });

export type ObstacleCréerDto = z.infer<typeof obstacleCréerSchema>;

/**
 * DTO de **sortie** — projection d'un obstacle persisté (Modèle §6.1). Les
 * champs nullable en base (`difficulté` et les champs de combinaison inline) sont
 * rendus en `null`, fidèles au sérialisé plutôt que silencieusement omis. Le
 * `.strip()` par défaut de Zod retire toute clé inattendue : parser la ligne
 * brute ne peut rien laisser fuir. Réutilisé par l'export RGPD (lot 1.3) — une
 * seule forme partagée (Architecture §2).
 */
export const obstacleSortieSchema = z.object({
  ...champsTechniquesSortie,
  seance_id: z.string(),
  type: typeObstacleSchema,
  hauteur: z.number(),
  répétitions: z.number(),
  barres: z.number(),
  refus: z.number(),
  difficulté: z.number().nullable(),
  nombre_d_éléments: z.number().nullable(),
  éléments: z.array(typeObstacleSimpleSchema).nullable(),
  // Lien vers la réutilisable instanciée (lot 2.5) ; `null` pour un obstacle
  // simple, une combinaison inline, ou un obstacle dé-lié (réutilisable
  // supprimée → `SET NULL`, valeurs et taux conservés).
  combinaison_ref: z.string().nullable(),
});

export type ObstacleSortie = z.infer<typeof obstacleSortieSchema>;
