/**
 * **Résumé d'une séance pour sa carte partageable** — dérivé pur (Modèle §7/§9,
 * Spec §5.4). Le **récap** d'une carte de bilan de séance simple (lot 3.3) : *ce
 * qui a été travaillé* (types d'obstacle), les *hauteurs* et le *taux de
 * réussite*. **Une seule** implémentation (Architecture §2) — le module `sharing`
 * (api) **orchestre** cette fonction, il ne recalcule rien.
 *
 * Réutilise `faitsSéance` (§7/§9, posé en 3.1) pour la fraction réussie : la
 * carte et le feed ne peuvent pas afficher des taux divergents (même source). Ce
 * module n'ajoute que la **projection d'affichage** (types & hauteurs distincts),
 * pas un nouveau calcul de performance.
 *
 * La **mise en avant d'un record** ne vit **pas** ici : un record est dérivé de
 * l'**historique** (`détecteJalons`, 3.1), pas d'une séance isolée. Le service
 * `sharing` compose les deux (récap de la séance + record éventuel de la séance).
 */

import { TYPES_OBSTACLE, type TypeObstacle } from '../enums/obstacle';
import { type FaitsSéance, faitsSéance } from './faits-seance';
import type { ObstacleFranchissement, TourFranchissement } from './franchissement';

/**
 * Récap objectif d'une séance pour sa carte (couche objective, §1). `faits` est
 * **`null`** pour une séance sans franchissement à résumer (un **Plat** :
 * régularité, sans hauteur ni taux — Modèle §3) ; la carte reste alors une carte
 * de régularité, **sans fausse célébration**.
 */
export interface RésuméCarte {
  /** Types d'obstacle travaillés, **distincts**, dans l'ordre du référentiel (vide pour un Plat / un Concours). */
  types_travaillés: TypeObstacle[];
  /** Hauteurs **distinctes** abordées (obstacles + tours), ordre croissant (vide pour un Plat). */
  hauteurs: number[];
  /** Faits objectifs agrégés (hauteur max, taux, sans-faute) ou `null` (régularité). */
  faits: FaitsSéance | null;
}

/**
 * Compose le récap de carte d'une séance à partir de ses franchissements. Pur et
 * déterministe : les types travaillés sont **dédupliqués** et ordonnés selon le
 * référentiel (`TYPES_OBSTACLE`), les hauteurs dédupliquées et triées ; le taux
 * vient de `faitsSéance` (jamais réimplémenté). Une séance de Plat (0 obstacle/
 * tour) ⇒ `types_travaillés` et `hauteurs` vides, `faits` `null`.
 */
export function résuméCarte(input: {
  obstacles: ObstacleFranchissement[];
  tours: TourFranchissement[];
}): RésuméCarte {
  const typesPrésents = new Set<TypeObstacle>(input.obstacles.map((o) => o.type));
  const types_travaillés = TYPES_OBSTACLE.filter((t) => typesPrésents.has(t));

  const hauteursPrésentes = new Set<number>();
  for (const o of input.obstacles) hauteursPrésentes.add(o.hauteur);
  for (const t of input.tours) hauteursPrésentes.add(t.hauteur);
  const hauteurs = [...hauteursPrésentes].sort((a, b) => a - b);

  return { types_travaillés, hauteurs, faits: faitsSéance(input) };
}
