import { z } from 'zod';
import { typeJalonSchema } from './referentiel';

/**
 * DTO des **métriques héros mono-cheval** (lot 3.2, Spec §5.2, UI/UX §6.2).
 * Surface de **lecture/composition** : le module `metrics` lit les séances via le
 * service `sessions`, dérive les métriques via `shared` (hauteur maîtrisée §10,
 * détection record/jalon de 3.1) et compose ces deux **surfaces héros**. App et
 * api partagent **exactement** ces formes — aucun type dupliqué (Architecture
 * §1/§2).
 *
 * **Exactement deux héros (Spec §5.2)** : (1) la **courbe de hauteur maîtrisée**
 * (plancher fiable + grand chiffre), (2) la **vitrine à records/jalons**. Pas de
 * graphe de taux (déjà encodé dans la maîtrisée). La heatmap / le benchmark
 * (5.x) sont du **diagnostic premium**, **hors** du set héros (§5.3).
 */

/**
 * Un **jalon** dérivé (record / première_fois) — miroir Zod de `Jalon`
 * (`calc/jalons`), validé au bord. Dérivé, jamais saisi ; absent du `déclaratif`
 * (§2). Alimente la **vitrine** (plaques laiton).
 */
export const jalonSchema = z.object({
  seance_id: z.string(),
  date: z.date(),
  type: typeJalonSchema,
  hauteur: z.number(),
});

export type JalonDto = z.infer<typeof jalonSchema>;

/**
 * Un **point de la courbe de maîtrise** : la hauteur maîtrisée (cm) à une date,
 * ou `null` tant que rien n'est maîtrisé / quand elle redescend sous tout
 * plancher (§5.5). Miroir Zod de `PointMaîtrise` (`calc/hauteur-maitrisee`).
 */
export const pointMaîtriseSchema = z.object({
  date: z.date(),
  hauteur: z.number().nullable(),
});

export type PointMaîtriseDto = z.infer<typeof pointMaîtriseSchema>;

/**
 * **Héros 1 — hauteur maîtrisée** : le **chiffre courant** (grand chiffre
 * « maîtrisée : 115 cm », `null` si rien encore), la **série** (la courbe dans le
 * temps) et le **record** absolu (cm) comme **référence laiton** au-dessus de la
 * barre maîtrisée (signature §2). La maîtrisée **peut redescendre** sans que le
 * record bouge (§5.5).
 */
export const maîtriseSchema = z.object({
  courante: z.number().nullable(),
  record: z.number().nullable(),
  série: z.array(pointMaîtriseSchema),
});

export type MaîtriseDto = z.infer<typeof maîtriseSchema>;

/**
 * **Héros 2 — vitrine à records/jalons** : le **record absolu gravé** (plus haut
 * franchissement propre, jamais effacé — §5.5) et la liste des **jalons**
 * (records + premières fois, ordre chronologique) en plaques laiton. Les
 * « séries propres » (§5.2) sont une famille de jalon laissée à un enrichissement
 * ultérieur (cf. 3.1) — `TYPES_JALON` est extensible sans casse.
 */
export const vitrineSchema = z.object({
  record: jalonSchema.nullable(),
  jalons: z.array(jalonSchema),
});

export type Vitrine = z.infer<typeof vitrineSchema>;

/**
 * Réponse des **métriques héros** d'un cheval (`GET /horses/:id/metrics`) : les
 * deux surfaces héros au-dessus du fil (3.1). Lecture seule, **jamais
 * verrouillée** (les héros sont gratuits, le gating 4.1 ne les touche pas).
 */
export const métriquesSchema = z.object({
  cheval_id: z.string(),
  maîtrise: maîtriseSchema,
  vitrine: vitrineSchema,
});

export type Métriques = z.infer<typeof métriquesSchema>;
