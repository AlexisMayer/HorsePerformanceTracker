import { z } from 'zod';
import type { TypeObstacleSimple } from '../enums/obstacle';
import { champsTechniquesSortie } from './champs-techniques';
import { typeObstacleSimpleSchema } from './referentiel';

/**
 * Contrats `shared` de la **combinaison réutilisable** (lot 2.5, module
 * `combinations`, Modèle §8, Spec §4). Source de vérité unique partagée app/api
 * (Architecture §1/§2) ; aucun type dupliqué. Le service `combinations` valide
 * ces schémas à chaque frontière (Architecture §5).
 *
 * Une réutilisable porte une **structure figée** (`nombre_d_éléments` +
 * `éléments`), **sans hauteur** (fournie à l'instanciation). Sa portée est le
 * **compte** (le `compte_id` vient du jeton, jamais du corps).
 */

const LIBELLÉS_NOMBRE: Record<number, string> = { 2: 'Double', 3: 'Triple', 4: 'Quadruple' };

/**
 * **Auto-nommage** d'une combinaison (Spec §4.3, Modèle §8) — pur et déterministe,
 * partagé app/api. Un nom est **cosmétique** (l'identité est l'`id`) et
 * **renommable** ; on en propose un par défaut quand l'utilisateur n'en saisit
 * pas. Forme : un libellé de cardinalité (« Double », « Triple », « Quadruple »,
 * sinon « Combinaison à N éléments ») suffixé du **type dominant** lorsque tous
 * les éléments sont identiques (« Triple oxer », « Double vertical »).
 */
export function nomAutoCombinaison(
  nombre_d_éléments: number,
  éléments?: readonly TypeObstacleSimple[],
): string {
  const base = LIBELLÉS_NOMBRE[nombre_d_éléments] ?? `Combinaison à ${nombre_d_éléments} éléments`;
  if (éléments && éléments.length > 0) {
    const [premier] = éléments;
    if (éléments.every((t) => t === premier)) {
      return `${base} ${premier.toLowerCase()}`;
    }
  }
  return base;
}

/**
 * Garde de cohérence `nombre_d_éléments ↔ éléments.length` : la liste ordonnée
 * **est** la structure, son cardinal doit égaler le compteur. Factorisée pour la
 * création (les deux fournis) et l'édition (les deux fournis ensemble).
 */
function vérifieCardinalité(
  c: { nombre_d_éléments?: number; éléments?: unknown[] },
  ctx: z.RefinementCtx,
): void {
  if (
    c.nombre_d_éléments !== undefined &&
    c.éléments !== undefined &&
    c.éléments.length !== c.nombre_d_éléments
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['éléments'],
      message: 'Le détail des éléments doit correspondre à `nombre_d_éléments`.',
    });
  }
}

/**
 * DTO d'**entrée** — création d'une réutilisable (depuis un détail de séance ou
 * directement). `compte_id` **n'est pas dans le corps** : il est posé par le
 * serveur depuis le compte authentifié (portée compte). `nom` est **optionnel**
 * (auto-nommé si absent — `nomAutoCombinaison`). La **structure est détaillée** :
 * `éléments` (≥ 2) est requis et son cardinal doit égaler `nombre_d_éléments`
 * (une réutilisable sans détail n'aurait rien à réutiliser).
 */
export const combinaisonCréerSchema = z
  .object({
    nom: z.string().min(1).max(120).optional(),
    nombre_d_éléments: z.number().int().min(2),
    éléments: z.array(typeObstacleSimpleSchema).min(2),
  })
  .superRefine(vérifieCardinalité);

export type CombinaisonCréerDto = z.infer<typeof combinaisonCréerSchema>;

/**
 * DTO d'**entrée** — « édition » d'une réutilisable. **Sémantique exposée par
 * l'API : modification = nouvelle** (Modèle §8, Spec §4.3) — `PATCH` ne mute pas
 * la ligne existante, il **crée une nouvelle** combinaison à partir de l'ancienne
 * (intacte) + ce corps ; l'identité reste stable, le benchmark fiable (lot 5.2).
 *
 * Tous les champs sont optionnels (un champ absent **hérite** de l'ancienne) ;
 * le `superRefine` rejette un corps **vide** (rien à dériver). Si `éléments` et
 * `nombre_d_éléments` sont fournis ensemble, leurs cardinaux doivent concorder ;
 * une concordance partielle (un seul des deux) est arbitrée par le **service**
 * (qui fusionne avec l'ancienne puis revérifie).
 */
export const combinaisonModifierSchema = z
  .object({
    nom: z.string().min(1).max(120).optional(),
    nombre_d_éléments: z.number().int().min(2).optional(),
    éléments: z.array(typeObstacleSimpleSchema).min(2).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.nom === undefined && c.nombre_d_éléments === undefined && c.éléments === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Au moins un champ doit être fourni pour dériver une nouvelle combinaison.',
      });
    }
    vérifieCardinalité(c, ctx);
  });

export type CombinaisonModifierDto = z.infer<typeof combinaisonModifierSchema>;

/**
 * DTO de **sortie** — projection d'une réutilisable (détail & liste). Les champs
 * de domaine (Modèle §8) + `usage_count`, **signal anti-bloat** exposé (« plus
 * utilisées », Spec §4.3) ; le `last_used_at` interne (clé de tri secondaire)
 * n'est **pas** projeté — le `.strip()` par défaut de Zod le retire, comme toute
 * clé inattendue (parser la ligne brute ne peut rien laisser fuir).
 */
export const combinaisonSortieSchema = z.object({
  ...champsTechniquesSortie,
  compte_id: z.string(),
  nom: z.string(),
  nombre_d_éléments: z.number(),
  éléments: z.array(typeObstacleSimpleSchema),
  usage_count: z.number(),
});

export type CombinaisonSortie = z.infer<typeof combinaisonSortieSchema>;
