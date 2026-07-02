import { z } from 'zod';
import { tendanceSchema } from './referentiel';

/**
 * DTO du **benchmark à combinaison constante** mono-cheval (lot 5.2, Spec §5.3,
 * Modèle §8/§9, UI/UX §6.5) — outil de **diagnostic premium**, **sous** la heatmap
 * (5.1) dans l'écran Analytique. Surface de **lecture/composition** : le module
 * `analytics` lit les séances via `sessions` et l'identité via `combinations`,
 * dérive la série via `shared` (`sérieBenchmark`, qui réutilise le taux §7) et
 * expose ces formes. App et api partagent **exactement** ces types — aucun type
 * dupliqué (Architecture §1/§2). Miroir Zod des interfaces `calc/benchmark`.
 *
 * **Diagnostic, hors set héros** (Spec §5.3) et **gaté premium/pro** (§8) :
 * l'endpoint est refusé au gratuit côté serveur (garde 4.1), l'app grise (4.2).
 * **Structure réutilisable en lecture seule scopée** par les comptes invité (4.6).
 */

/**
 * Un **point** du benchmark : une instanciation `live` d'un `combinaison_ref`. Le
 * `taux` est le **taux §7 combinaison** exact (∈ [0, 1]) ; la `hauteur` est une
 * **annotation** (la barre du jour, variable — la structure, elle, est constante).
 * Miroir Zod de `PointBenchmark` (`calc/benchmark`).
 *
 * Note transport : `date` est typée `Date` (le serveur la valide ainsi) ; le JSON
 * la rend en chaîne ISO — l'affichage n'en dépend pas (courbe positionnée par
 * ordre chronologique, pas par date ; cf. `metrics` 3.2).
 */
export const pointBenchmarkSchema = z.object({
  date: z.date(),
  taux: z.number(),
  hauteur: z.number(),
});

export type PointBenchmarkDto = z.infer<typeof pointBenchmarkSchema>;

/**
 * Réponse de la **série** d'un `combinaison_ref` pour un cheval
 * (`GET /horses/:id/benchmark/:combinaison_ref`) : l'identité suivie (`nom`,
 * `nombre_d_éléments`, lus via `combinations`), les **points** ordonnés par date
 * (chacun taux §7 + hauteur en annotation) et la **tendance** globale (`null` sur
 * un point isolé — pas de fausse tendance). **Jamais** de mélange d'identités.
 */
export const benchmarkSérieSchema = z.object({
  cheval_id: z.string(),
  combinaison_ref: z.string(),
  nom: z.string(),
  nombre_d_éléments: z.number(),
  points: z.array(pointBenchmarkSchema),
  tendance: tendanceSchema.nullable(),
});

export type BenchmarkSérieDto = z.infer<typeof benchmarkSérieSchema>;

/**
 * Une **combinaison benchmarkable** pour un cheval (élément du sélecteur) : son
 * identité (`combinaison_ref`), son `nom` (« Double 1 », « Triple oxer »…), sa
 * structure (`nombre_d_éléments`) et le **nombre d'instanciations `live`**
 * (`n_points`) — `n_points = 1` signale une combinaison à **rejouer** (un point,
 * pas de tendance). Le `derniere` interne (récence, tri) n'est **pas** projeté.
 */
export const combinaisonBenchmarkableSchema = z.object({
  combinaison_ref: z.string(),
  nom: z.string(),
  nombre_d_éléments: z.number(),
  n_points: z.number(),
});

export type CombinaisonBenchmarkableDto = z.infer<typeof combinaisonBenchmarkableSchema>;

/**
 * Réponse de la **liste des combinaisons benchmarkables** d'un cheval
 * (`GET /horses/:id/benchmark`) : les réutilisables **instanciées** pour ce cheval,
 * triées **par usage** (per-cheval, anti-bloat Spec §4.3). Vide = **invitation**
 * (« rejoue une combinaison enregistrée pour suivre sa progression »).
 */
export const benchmarkListeSchema = z.object({
  cheval_id: z.string(),
  combinaisons: z.array(combinaisonBenchmarkableSchema),
});

export type BenchmarkListeDto = z.infer<typeof benchmarkListeSchema>;
