import { z } from 'zod';
import { chevalSortieSchema } from './cheval';
import { compteSortieSchema } from './compte';
import { contexteSortieSchema } from './contexte';
import { obstacleSortieSchema } from './obstacle';
import { séanceSortieSchema } from './seance';
import { tourSortieSchema } from './tour';

/**
 * Contrats RGPD du **compte** (lot 1.3, module `auth-account`) : la forme de
 * l'**export complet** (droit à la portabilité) et le DTO de **suppression**
 * (droit à l'effacement). Source de vérité unique partagée app/api
 * (Architecture §2/§5) ; aucun type dupliqué.
 *
 * Règle « jamais de secret en sortie » (héritée de 0.2/1.1) appliquée à l'export :
 * le compte est projeté via `compteSortieSchema` (qui **ne déclare pas**
 * `password_hash`) et les `.object()` Zod **retirent toute clé inconnue**. Les
 * tables techniques d'auth (refresh tokens, jetons de vérification) ne sont
 * **pas** des données de l'utilisateur au sens portabilité : elles sont
 * **exclues** de l'export. À l'inverse, l'export **inclut `live` ET
 * `déclaratif`** (les deux sont des données saisies par l'utilisateur).
 */

// ───────────────────────────── Suppression ─────────────────────────────

/**
 * Confirmation de **suppression de compte**. La route est déjà authentifiée
 * (garde JWT) ; on **re-vérifie l'identité par mot de passe** (décision tranchée,
 * cf. journal 1.3) : une action destructrice et irréversible mérite une
 * confirmation explicite, qui protège contre un jeton d'accès volé.
 */
export const accountDeleteSchema = z.object({
  password: z.string().min(1),
});

export type AccountDeleteDto = z.infer<typeof accountDeleteSchema>;

// ───────────────────────────── Export ─────────────────────────────

/**
 * L'export **réutilise les projections de sortie** des entités (lot 2.2) plutôt
 * que de redéclarer leur forme : aucune forme dupliquée (Architecture §2). La
 * séance exportée inclut ses unités atomiques imbriquées et les **deux
 * provenances** (`live` **et** `déclaratif`) — la curation des métriques (live
 * seul) est une affaire de rapport, pas d'export brut.
 */
export const obstacleExportSchema = obstacleSortieSchema;
export type ObstacleExport = z.infer<typeof obstacleExportSchema>;

export const tourExportSchema = tourSortieSchema;
export type TourExport = z.infer<typeof tourExportSchema>;

export const contexteExportSchema = contexteSortieSchema;
export type ContexteExport = z.infer<typeof contexteExportSchema>;

export const seanceExportSchema = séanceSortieSchema;
export type SeanceExport = z.infer<typeof seanceExportSchema>;

/**
 * Cheval exporté (Modèle §3) avec l'arbre de ses séances. Réutilise la
 * projection de fiche `chevalSortieSchema` (lot 2.1) — aucune forme dupliquée :
 * l'export n'ajoute que l'arbre imbriqué des séances.
 */
export const chevalExportSchema = chevalSortieSchema.extend({
  seances: z.array(seanceExportSchema),
});

export type ChevalExport = z.infer<typeof chevalExportSchema>;

/**
 * Payload d'**export complet** d'un compte (portabilité). Arbre de propriété du
 * Modèle §3 : `Compte → Cheval → Séance → {Obstacle, Tour, Contexte}`. Le
 * compte est projeté **sans secret** (`compteSortieSchema`). `exported_at`
 * horodate le cliché (métadonnée de portabilité).
 */
export const accountExportSchema = z.object({
  exported_at: z.date(),
  compte: compteSortieSchema,
  chevaux: z.array(chevalExportSchema),
});

export type AccountExport = z.infer<typeof accountExportSchema>;
