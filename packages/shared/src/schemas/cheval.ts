import { z } from 'zod';
import { hauteurSchema, niveauChevalSchema } from './referentiel';

/**
 * Contrats `shared` de la **fiche cheval** (lot 2.1, module `horses`). Source de
 * vérité unique partagée app/api (Architecture §1/§2) ; aucun type dupliqué. Le
 * service `horses` valide ces schémas à chaque frontière (Architecture §5).
 *
 * Le `niveau` est le niveau de **compétition du cheval** (`amateur | pro`,
 * référentiel §0) — distinct du `type` du **compte** (`amateur | coach`).
 */

/**
 * DTO d'**entrée** — création d'un cheval.
 *
 * `compte_id` n'est pas dans le corps : il est posé par le serveur depuis le
 * compte authentifié (scoping au compte courant). `âge`/`race` sont optionnels.
 */
export const chevalCréerSchema = z.object({
  nom: z.string().min(1).max(120),
  niveau: niveauChevalSchema,
  hauteur_de_référence: hauteurSchema,
  âge: z.number().int().positive().max(60).optional(),
  race: z.string().min(1).max(120).optional(),
});

export type ChevalCréerDto = z.infer<typeof chevalCréerSchema>;

/**
 * DTO d'**entrée** — édition d'un cheval (PATCH, sémantique partielle).
 *
 * Tous les champs sont optionnels : un champ **absent** reste inchangé. Pour les
 * champs facultatifs (`âge`, `race`), `null` est accepté afin de les **effacer**
 * (les remettre à vide). Le `superRefine` rejette un corps **vide** (rien à
 * éditer) → 400 à la frontière, plutôt qu'un PATCH muet.
 */
export const chevalModifierSchema = z
  .object({
    nom: z.string().min(1).max(120).optional(),
    niveau: niveauChevalSchema.optional(),
    hauteur_de_référence: hauteurSchema.optional(),
    âge: z.number().int().positive().max(60).nullable().optional(),
    race: z.string().min(1).max(120).nullable().optional(),
  })
  .superRefine((dto, ctx) => {
    if (Object.values(dto).every((v) => v === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Au moins un champ doit être fourni pour la mise à jour.',
      });
    }
  });

export type ChevalModifierDto = z.infer<typeof chevalModifierSchema>;

/**
 * DTO de **sortie** — projection d'un cheval (détail & liste).
 *
 * Distinct de `chevalExportSchema` (qui imbrique l'arbre des séances pour la
 * portabilité, lot 1.3) : ici, la fiche seule. Les champs facultatifs nullable
 * en base (`âge`, `race`) sont rendus en `null` (fidèles au sérialisé, pas
 * silencieusement omis). Le `.strip()` par défaut de Zod retire toute clé
 * inattendue : parser la ligne brute ne peut donc rien laisser fuir.
 *
 * `archivé` (lot 4.3) est projeté : l'app en a besoin pour **exclure** le cheval
 * du sélecteur actif (UI/UX §5) et le ranger dans la **section « archivés »**
 * (lecture seule). L'archivage/désarchivage passe par des **actions dédiées**
 * (`POST /horses/:id/archive` · `/unarchive`), **pas** par le PATCH générique —
 * ce qui garde la **garde de quota** (4.1) sur le seul chemin de désarchivage.
 */
export const chevalSortieSchema = z.object({
  id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  compte_id: z.string(),
  nom: z.string(),
  niveau: niveauChevalSchema,
  hauteur_de_référence: z.number(),
  âge: z.number().nullable(),
  race: z.string().nullable(),
  archivé: z.boolean().default(false),
});

export type ChevalSortie = z.infer<typeof chevalSortieSchema>;
