import { z } from 'zod';
import { champsTechniquesSortie } from './champs-techniques';
import { contexteCréerSchema, contexteSortieSchema } from './contexte';
import { obstacleCréerSchema, obstacleSortieSchema } from './obstacle';
import { provenanceSchema, typeSéanceSchema } from './referentiel';
import { tourCréerSchema, tourSortieSchema } from './tour';

/**
 * DTO d'**entrée** — création d'une séance avec ses unités atomiques imbriquées
 * (Modèle §3/§4/§5, lot 2.2).
 *
 * - **`cheval_id` n'est pas dans le corps** : il provient de l'URL de la route
 *   ressource `POST /horses/:id/sessions` et le serveur **vérifie la propriété**
 *   du cheval (module `sessions` → `horses`). Même posture que `chevalCréerSchema`
 *   (le `compte_id` vient du jeton, pas du corps) : on ne fait jamais confiance
 *   au corps pour la cible.
 * - **`idempotency_key`** (UUID généré côté client, **requis**) : un réessai avec
 *   la même clé ne crée pas de doublon (Architecture §5, Stack §4). C'est l'unique
 *   ajout du lot 2.2 hors Modèle de données socle (cf. journal).
 * - La **`date` n'est pas fournie** : le serveur l'horodate à l'enregistrement
 *   (intégrité, §2). De même, `date_modification` reste `null` à la création.
 * - **`provenance`** par défaut `live` ; le chemin accepte `déclaratif` pour
 *   l'amorçage (le flux d'onboarding qui s'en sert est le lot 3.5).
 *
 * Le **type pilote la structure**, validé par `superRefine` :
 *  - `Concours` → des `tours`, jamais d'`obstacles` ;
 *  - entraînement (Plat/Gymnastique/Parcours) → des `obstacles`, jamais de
 *    `tours` (un `Plat` peut avoir **0 obstacle** : fréquence/régularité seules).
 */
export const séanceCréerSchema = z
  .object({
    type: typeSéanceSchema,
    idempotency_key: z.string().uuid(),
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

/**
 * DTO de **sortie** — projection d'une séance persistée avec ses unités
 * atomiques imbriquées (Modèle §3/§5). Lecture brute suffisante pour prouver la
 * persistance (lot 2.2) ; le feed riche est le lot 3.1.
 *
 * `date` est la date métier (immuable) ; `date_modification` est `null` tant que
 * la séance n'a pas été éditée (intégrité, §2). La clé d'idempotence est une
 * donnée **technique** : elle n'est **pas projetée** ici. Réutilisé par l'export
 * RGPD (lot 1.3) — une seule forme partagée (Architecture §2), `live` ET
 * `déclaratif` inclus.
 */
export const séanceSortieSchema = z.object({
  ...champsTechniquesSortie,
  cheval_id: z.string(),
  type: typeSéanceSchema,
  date: z.date(),
  date_modification: z.date().nullable(),
  provenance: provenanceSchema,
  obstacles: z.array(obstacleSortieSchema),
  tours: z.array(tourSortieSchema),
  contexte: contexteSortieSchema.nullable(),
});

export type SéanceSortie = z.infer<typeof séanceSortieSchema>;
