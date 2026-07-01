import { z } from 'zod';
import { pointMaîtriseSchema } from './metrics';
import { niveauChevalSchema } from './referentiel';

/**
 * Contrats `shared` du **bilan de progression** (lot 4.4, Spec §6, module
 * `progression-report`). Source de vérité unique partagée app/api (Architecture
 * §1/§2) : aucun type dupliqué. Le module compose un **artefact autonome**
 * (PDF/lien) destiné à **quelqu'un sans l'app** (le client d'un coach), bâti
 * **uniquement sur la couche objective** et les séances `live` (Modèle §2).
 *
 * Trois familles de contrats :
 *  - **paramètres de génération** (curation §6.3) : `période` + `indicateurs`
 *    choisis + `format` ; la donnée sous-jacente reste **inviolable** ;
 *  - **sections** (§6.2) : les 6 blocs du rapport, composés via `metrics` (3.2) et
 *    `sessions` (2.2) + la régularité (`shared`) — **rien n'est recalculé** ;
 *  - **artefact** produit + enveloppe de sortie.
 *
 * **Premium/Pro** (§8) : l'endpoint est gardé par l'entitlement (4.1,
 * capacité `bilan_progression`) — **refusé au gratuit**. Premium = rapport
 * personnel (mono-cheval) ; pro = multi-chevaux (un rapport par cheval).
 */

/* ------------------------------------------------------------------ *
 * Paramètres de génération — curation au niveau rapport (§6.3)
 * ------------------------------------------------------------------ */

/**
 * **Période** documentée par le rapport (curation §6.3). Bornes ISO **incluses** ;
 * `null` = borne ouverte (tout l'historique de ce côté). La fenêtre **restreint**
 * ce qu'on résume — elle n'altère jamais la donnée (inviolabilité §2).
 */
export const périodeParamsSchema = z
  .object({
    from: z.string().datetime({ offset: true }).nullable().default(null),
    to: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .superRefine((p, ctx) => {
    if (p.from && p.to && new Date(p.from) > new Date(p.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'La fin de période doit être postérieure au début.',
      });
    }
  });

export type PériodeParams = z.infer<typeof périodeParamsSchema>;

/**
 * **Indicateurs** présentés (curation §6.3) : le coach choisit quelles sections
 * facultatives afficher. `identité` et `période` sont **toujours** présentes (le
 * cadre du livrable) ; les quatre autres sections sont activables (défaut : tout
 * affiché). Décocher un indicateur **retire sa section** sans toucher la donnée.
 */
export const indicateursSchema = z.object({
  niveau_démontré: z.boolean().default(true),
  performance_concours: z.boolean().default(true),
  régularité: z.boolean().default(true),
  trajectoire: z.boolean().default(true),
});

export type IndicateursBilan = z.infer<typeof indicateursSchema>;

/**
 * **Format** de l'artefact : `lien` (document web autonome, HTML) ou `pdf`. Le
 * pipeline `HTML+CSS → PDF via Playwright` (Stack §5) est le rendu **prod** ; en
 * **dev**, la sortie est **locale/stub** (le document HTML fait office de lien).
 */
export const formatBilanSchema = z.enum(['lien', 'pdf']);

export type FormatBilan = z.infer<typeof formatBilanSchema>;

/**
 * Corps de `POST /horses/:id/progression-report`. Tout est optionnel : un corps
 * vide génère le rapport **complet** sur **tout l'historique** en **lien**. La
 * curation ne fait que projeter — la donnée reste inviolable (§6.3).
 */
export const bilanProgressionParamsSchema = z.object({
  période: périodeParamsSchema.default({}),
  indicateurs: indicateursSchema.default({}),
  format: formatBilanSchema.default('lien'),
});

export type BilanProgressionParams = z.infer<typeof bilanProgressionParamsSchema>;

/* ------------------------------------------------------------------ *
 * Sections du rapport (§6.2) — sortie composée
 * ------------------------------------------------------------------ */

/** §6.2 (1) **Identité** — fiche cheval (couche objective ; aucun contexte privé). */
export const identitéBilanSchema = z.object({
  nom: z.string(),
  niveau: niveauChevalSchema,
  hauteur_de_référence: z.number(),
  âge: z.number().nullable(),
  race: z.string().nullable(),
});

export type IdentitéBilan = z.infer<typeof identitéBilanSchema>;

/**
 * §6.2 (2) **Niveau démontré** — hauteur **maîtrisée** (plancher fiable, réutilisée
 * de `metrics`/§10) + plus haut **franchissement propre en concours** (tour
 * sans-faute le plus haut, dérivé du primitif `shared`). `null` tant que rien
 * n'est démontré.
 */
export const niveauDémontréBilanSchema = z.object({
  hauteur_maîtrisée: z.number().nullable(),
  record_sans_faute_concours: z.number().nullable(),
});

export type NiveauDémontréBilan = z.infer<typeof niveauDémontréBilanSchema>;

/** Performance concours à une hauteur d'épreuve (tours joués, sans-faute, taux). */
export const performanceHauteurSchema = z.object({
  hauteur: z.number(),
  tours: z.number(),
  sans_faute: z.number(),
  taux_sans_faute: z.number().nullable(),
});

export type PerformanceHauteur = z.infer<typeof performanceHauteurSchema>;

/**
 * §6.2 (3) **Performance concours** — tours joués, sans-faute par hauteur,
 * résultats dans le temps. Dérivé des séances `Concours` **`live`** uniquement
 * (le sans-faute est le primitif `shared`, jamais réimplémenté).
 */
export const performanceConcoursBilanSchema = z.object({
  total_tours: z.number(),
  tours_sans_faute: z.number(),
  taux_sans_faute: z.number().nullable(),
  par_hauteur: z.array(performanceHauteurSchema),
});

export type PerformanceConcoursBilan = z.infer<typeof performanceConcoursBilanSchema>;

/**
 * §6.2 (4) **Régularité & suivi** — le **cœur du bilan** (Spec §6.1). Miroir Zod
 * de `RégularitéBilan` (`calc/regularite`), validé au bord ; dates en `Date`
 * (rendues en chaînes ISO sur le fil, comme `metrics`).
 */
export const régularitéBilanSchema = z.object({
  total_séances: z.number(),
  début: z.date().nullable(),
  fin: z.date().nullable(),
  jours_couverts: z.number(),
  séances_par_mois: z.number(),
  semaines_actives: z.number(),
  plus_longue_série_semaines: z.number(),
});

export type RégularitéBilanDto = z.infer<typeof régularitéBilanSchema>;

/** Sens de la trajectoire de maîtrise sur la période (émotion §6.1). */
export const tendanceSchema = z.enum(['hausse', 'stable', 'baisse']);

export type Tendance = z.infer<typeof tendanceSchema>;

/**
 * §6.2 (5) **Trajectoire** — **courbe de hauteur maîtrisée** (réutilisée de
 * `metrics`, curée à la période) + **tendance** (départ → arrivée). Aucun
 * recalcul de la maîtrisée : la série vient de `metrics`, la curation ne fait que
 * la restreindre à la fenêtre.
 */
export const trajectoireBilanSchema = z.object({
  points: z.array(pointMaîtriseSchema),
  tendance: tendanceSchema.nullable(),
  départ: z.number().nullable(),
  arrivée: z.number().nullable(),
});

export type TrajectoireBilan = z.infer<typeof trajectoireBilanSchema>;

/** §6.2 (6) **Période** — fenêtre documentée + nombre de séances `live` retenues. */
export const périodeMétaBilanSchema = z.object({
  from: z.date().nullable(),
  to: z.date().nullable(),
  nb_séances: z.number(),
});

export type PériodeMétaBilan = z.infer<typeof périodeMétaBilanSchema>;

/**
 * Les **6 sections** du rapport (§6.2). `identité` et `période` sont toujours là
 * (cadre du livrable) ; les quatre autres sont **présentes seulement si l'
 * indicateur est activé** (curation §6.3) — leur absence encode le choix du coach.
 */
export const bilanSectionsSchema = z.object({
  identité: identitéBilanSchema,
  niveau_démontré: niveauDémontréBilanSchema.optional(),
  performance_concours: performanceConcoursBilanSchema.optional(),
  régularité: régularitéBilanSchema.optional(),
  trajectoire: trajectoireBilanSchema.optional(),
  période: périodeMétaBilanSchema,
});

export type BilanSections = z.infer<typeof bilanSectionsSchema>;

/* ------------------------------------------------------------------ *
 * Artefact produit + enveloppe de sortie
 * ------------------------------------------------------------------ */

/**
 * L'**artefact** généré (Stack §5). `url` : URL présignée **Object Storage** en
 * prod, `file://` **local** en dev. `stub` = vrai quand la sortie est un
 * substitut de dev (ex. le PDF demandé rendu en HTML local, la chaîne
 * Job/Object Storage/Playwright étant différée infra — non bloquant DoD).
 */
export const artefactBilanSchema = z.object({
  format: formatBilanSchema,
  url: z.string(),
  type_contenu: z.string(),
  taille_octets: z.number(),
  stub: z.boolean(),
});

export type ArtefactBilan = z.infer<typeof artefactBilanSchema>;

/**
 * Réponse de `POST /horses/:id/progression-report` : les **sections** composées
 * (pour un aperçu app soigné) **et** l'**artefact** téléchargeable/partageable
 * (le livrable pro, pour un client sans l'app). Lecture/composition pure : la
 * génération n'écrit **aucune** donnée métier (inviolabilité §2).
 */
export const bilanProgressionSchema = z.object({
  cheval_id: z.string(),
  généré_le: z.date(),
  format: formatBilanSchema,
  sections: bilanSectionsSchema,
  artefact: artefactBilanSchema,
});

export type BilanProgression = z.infer<typeof bilanProgressionSchema>;
