import { z } from 'zod';
import { contexteSortieSchema } from './contexte';
import { provenanceSchema, typeJalonSchema, typeSéanceSchema } from './referentiel';

/**
 * DTO du **fil mono-cheval** (lot 3.1, Spec §5.1, UI/UX §6.2). Surface de
 * **lecture/composition** : le module `feed` lit les séances via le service
 * `sessions`, calcule les dérivés via `shared` (faits §7/§9, jalons §10) et
 * compose ce fil. App et api partagent **exactement** ces formes — aucun type
 * dupliqué (Architecture §1/§2).
 *
 * **Deux couches étanches (Modèle §1)** : les **faits objectifs** (`faits`) sont
 * en avant ; le **contexte qualitatif** (`contexte`) ne vient qu'en **légende**,
 * jamais agrégé. Une entrée de **jalon** est injectée à côté de la séance `live`
 * qui l'a généré.
 */

/**
 * Faits objectifs agrégés d'une séance (couche objective, §1/§7/§9). Miroir Zod
 * de `FaitsSéance` (`calc/faits-seance`) — la même forme dérivée, validée au
 * bord. `taux_réussite` ∈ [0, 1] ou `null` (non calculable). Le libellé
 * d'affichage (« propre » entraînement / « sans-faute » concours) est choisi côté
 * UI selon le `type` — pas porté ici.
 */
export const faitsSéanceSchema = z.object({
  hauteur_max: z.number(),
  efforts_totaux: z.number(),
  efforts_propres: z.number(),
  taux_réussite: z.number().nullable(),
  sans_faute: z.boolean(),
});

export type FaitsSéanceDto = z.infer<typeof faitsSéanceSchema>;

/**
 * Entrée de **séance** : une séance avec des franchissements à résumer. Faits en
 * avant, contexte (0..1) en légende. `provenance` permet à l'UI de marquer une
 * séance `déclaratif` (« antérieure à l'app »).
 */
export const entréeSéanceFeedSchema = z.object({
  kind: z.literal('séance'),
  seance_id: z.string(),
  date: z.date(),
  date_modification: z.date().nullable(),
  provenance: provenanceSchema,
  type: typeSéanceSchema,
  faits: faitsSéanceSchema,
  contexte: contexteSortieSchema.nullable(),
});

/**
 * Entrée de **régularité** : une séance sans franchissement à résumer — un
 * **Plat** (0 obstacle, Modèle §3) marque la fréquence/continuité, **sans**
 * hauteur ni fautes. Le contexte (0..1) reste en légende.
 */
export const entréeRégularitéFeedSchema = z.object({
  kind: z.literal('régularité'),
  seance_id: z.string(),
  date: z.date(),
  date_modification: z.date().nullable(),
  provenance: provenanceSchema,
  type: typeSéanceSchema,
  contexte: contexteSortieSchema.nullable(),
});

/**
 * Entrée de **jalon** injectée dans le fil (célébration — laiton, UI/UX §2/§3),
 * rattachée à la séance `live` qui l'a généré (`seance_id` + `date`). Dérivée,
 * jamais saisie ; absente des séances `déclaratif` (§2).
 */
export const entréeJalonFeedSchema = z.object({
  kind: z.literal('jalon'),
  seance_id: z.string(),
  date: z.date(),
  type_jalon: typeJalonSchema,
  hauteur: z.number(),
});

/** Une entrée de feed = séance | régularité | jalon (union discriminée par `kind`). */
export const entréeFeedSchema = z.discriminatedUnion('kind', [
  entréeSéanceFeedSchema,
  entréeRégularitéFeedSchema,
  entréeJalonFeedSchema,
]);

export type EntréeSéanceFeed = z.infer<typeof entréeSéanceFeedSchema>;
export type EntréeRégularitéFeed = z.infer<typeof entréeRégularitéFeedSchema>;
export type EntréeJalonFeed = z.infer<typeof entréeJalonFeedSchema>;
export type EntréeFeed = z.infer<typeof entréeFeedSchema>;

/**
 * Page de fil : les entrées (récent → ancien), plus un **curseur** de pagination
 * simple. `next_before` est l'horodatage (ISO) à repasser en `before` pour
 * charger la tranche plus ancienne ; `null` quand il n'y a plus rien. Les jalons
 * sont toujours dérivés de l'historique `live` **complet** (la pagination ne
 * tranche que les séances affichées).
 */
export const filSchema = z.object({
  cheval_id: z.string(),
  entrées: z.array(entréeFeedSchema),
  next_before: z.string().nullable(),
  has_more: z.boolean(),
});

export type Fil = z.infer<typeof filSchema>;

/**
 * Query de pagination du fil (`GET /horses/:id/feed`). `before` (ISO) borne les
 * séances **strictement plus anciennes** que ce curseur ; `limit` plafonne le
 * nombre de **séances** de la page (les jalons injectés ne comptent pas dans la
 * limite). Validée au bord (Architecture §5).
 */
export const feedQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
