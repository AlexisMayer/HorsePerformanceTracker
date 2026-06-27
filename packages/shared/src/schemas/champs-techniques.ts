import { z } from 'zod';

/**
 * Champs techniques communs, en **sortie** (id + horodatages), Modèle §3.
 * Brique partagée par toutes les projections de sortie (`*SortieSchema`) afin
 * qu'aucune forme ne soit dupliquée (Architecture §2). `id` est rendu en
 * `string` (UUID opaque) ; `created_at`/`updated_at` en `Date` (sérialisées par
 * la frontière HTTP). La `date`/`date_modification` *métier* d'une séance est
 * distincte et déclarée sur sa propre projection.
 */
export const champsTechniquesSortie = {
  id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
};
