import type { CelluleHeatmapDto, HeatmapDto } from '@hpt/shared';

/**
 * Helpers **purs** d'affichage de la heatmap (lot 5.1) — aucun import React
 * Native, donc testables par Vitest. Ils ne font que **présenter** un dérivé déjà
 * calculé par `shared` (`agrègeHeatmap`, qui réutilise le taux §7) : **jamais** de
 * calcul métier ici (il vit dans `shared`, Architecture §2). Les cellules restent
 * lisibles plein soleil (chiffres tabulaires côté composant, §8), et l'on
 * **distingue** une case sans donnée (« — ») d'une case à 0 % (rouille).
 */

/** Taux en pourcentage entier (chiffres tabulaires) : `0.833 → "83"`, `0 → "0"`, `1 → "100"`. */
export function formatTaux(taux: number): string {
  return String(Math.round(taux * 100));
}

/**
 * **Index** des cellules par couple `type × hauteur` (une passe) — la grille
 * itère lignes × colonnes et **lit** en O(1). Pur : construit une `Map` dont la
 * clé encode le couple ; l'absence d'entrée = **pas de donnée**.
 */
export function indexerCellules(cellules: CelluleHeatmapDto[]): Map<string, CelluleHeatmapDto> {
  const index = new Map<string, CelluleHeatmapDto>();
  for (const c of cellules) index.set(cléCellule(c.type, c.hauteur), c);
  return index;
}

/** Lit la cellule `(type, hauteur)` dans l'index, ou `undefined` si **pas de donnée**. */
export function litCellule(
  index: Map<string, CelluleHeatmapDto>,
  type: string,
  hauteur: number,
): CelluleHeatmapDto | undefined {
  return index.get(cléCellule(type, hauteur));
}

function cléCellule(type: string, hauteur: number): string {
  return `${type} ${hauteur}`;
}

/** Vrai si la heatmap contient au moins une cellule (sinon l'écran invite à loguer). */
export function aDesDonnées(heatmap: HeatmapDto): boolean {
  return heatmap.cellules.length > 0;
}

/**
 * **Aspect visuel** d'une case, dérivé du taux — la seule décision d'affichage,
 * isolée ici (pure, testée). Le composant mappe ces rôles sur les tokens de thème
 * (§3), gardant les hex hors de la logique :
 *  - `vide`   : pas de donnée → « — » (jamais confondu avec 0 %) ;
 *  - `échec`  : taux 0 → teinte **rouille** sobre (0 %, présent) ;
 *  - `rempli` : taux > 0 → **vert** dont l'`opacité` suit le taux (vert plein →
 *    vide, UI/UX §6.5) ; `contrasteFort` dit si le texte doit passer en crème
 *    (fond assez plein) pour rester lisible **plein soleil** (AA+, §8).
 */
export type CelluleVisuel =
  | { kind: 'vide' }
  | { kind: 'échec' }
  | { kind: 'rempli'; opacité: number; contrasteFort: boolean };

export function celluleVisuel(cellule: CelluleHeatmapDto | undefined): CelluleVisuel {
  if (cellule === undefined) return { kind: 'vide' };
  if (cellule.taux <= 0) return { kind: 'échec' };
  // Vert plein → vide : la plus faible réussite reste visible (~0.2), 100 % remplit.
  const opacité = 0.2 + 0.8 * Math.min(1, cellule.taux);
  return { kind: 'rempli', opacité, contrasteFort: cellule.taux >= 0.55 };
}

/**
 * Libellé accessible d'une case (lecteurs d'écran, §8) : nomme le couple, le taux
 * et le **volume** (fiabilité), ou l'absence de donnée — sans jamais confondre
 * « pas de donnée » et « 0 % ».
 */
export function celluleAccessibilityLabel(
  type: string,
  hauteur: number,
  cellule: CelluleHeatmapDto | undefined,
): string {
  if (cellule === undefined) return `${type}, ${hauteur} centimètres : pas de donnée.`;
  return `${type}, ${hauteur} centimètres : ${formatTaux(cellule.taux)} % de réussite sur ${cellule.n_obstacles} obstacle${cellule.n_obstacles > 1 ? 's' : ''}.`;
}
