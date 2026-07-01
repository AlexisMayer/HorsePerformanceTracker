import { z } from 'zod';
import { typeObstacleSchema } from './referentiel';

/**
 * DTO de la **heatmap type × hauteur** mono-cheval (lot 5.1, Spec §5.3, Modèle
 * §9, UI/UX §6.5) — outil de **diagnostic premium**. Surface de
 * **lecture/composition** : le module `analytics` lit les séances via le service
 * `sessions`, agrège via `shared` (`agrègeHeatmap`, qui réutilise le taux §7) et
 * expose cette matrice. App et api partagent **exactement** ces formes — aucun
 * type dupliqué (Architecture §1/§2). Miroir Zod des interfaces `calc/heatmap`.
 *
 * **Diagnostic, hors set héros** (Spec §5.3) et **gaté premium/pro** (§8) :
 * l'endpoint est refusé au gratuit côté serveur (garde 4.1), l'app grise (4.2).
 */

/**
 * Une **cellule** de la heatmap (couple `type × hauteur` **ayant des données**) :
 * le `taux` exact agrégé (§7) + le **volume** (`efforts_totaux`, `n_obstacles`)
 * pour la fiabilité. Miroir Zod de `CelluleHeatmap` (`calc/heatmap`). L'absence
 * d'un couple de la liste = **pas de donnée** (« — »), distincte d'un `taux = 0`.
 */
export const celluleHeatmapSchema = z.object({
  type: typeObstacleSchema,
  hauteur: z.number(),
  taux: z.number(),
  efforts_propres: z.number(),
  efforts_totaux: z.number(),
  n_obstacles: z.number(),
});

export type CelluleHeatmapDto = z.infer<typeof celluleHeatmapSchema>;

/**
 * Réponse de la **heatmap** d'un cheval (`GET /horses/:id/heatmap`) : les
 * **lignes** présentes (`types`, ordre du référentiel → Combinaison en dernier,
 * sa propre ligne), les **colonnes** présentes (`hauteurs`, croissant) et les
 * **cellules avec données**. Lecture seule ; **structure réutilisable en lecture
 * seule scopée** par les comptes invité (4.6, qui dépendra de ce endpoint).
 */
export const heatmapSchema = z.object({
  cheval_id: z.string(),
  types: z.array(typeObstacleSchema),
  hauteurs: z.array(z.number()),
  cellules: z.array(celluleHeatmapSchema),
});

export type HeatmapDto = z.infer<typeof heatmapSchema>;
