/**
 * **Faits objectifs d'une séance** — agrégat dérivé pur (Modèle §1/§7/§9), la
 * couche « colonne vertébrale » d'une entrée de feed (faits en avant, contexte
 * en légende — Spec §5.1). **Aucune** donnée de la couche contexte (ressenti,
 * note, difficulté) n'entre ici (§1 : jamais agrégée).
 *
 * Réutilise la formule de taux du §7 (`tauxObstacleSimple` sur efforts/fautes
 * agrégés) — **une seule** implémentation (Architecture §2). Sert le feed (3.1)
 * et, à venir, la carte partageable (3.3).
 *
 * Unification entraînement/concours par la notion d'**effort** :
 *  - obstacle simple → `répétitions` efforts ; combinaison → `répétitions ×
 *    nombre_d_éléments` efforts (dénominateur exact, §7) ;
 *  - tour de concours → **1** effort (propre s'il est sans-faute).
 * Le taux d'un concours = efforts propres / efforts = **taux de sans-faute**
 * (§9) ; pour un entraînement = **taux de réussite** (§7). Le libellé (« propre »
 * vs « sans-faute ») est choisi côté UI selon le type — pas ici.
 */

import { estCombinaison } from '../enums/obstacle';
import type { ObstacleFranchissement, TourFranchissement } from './franchissement';
import { tauxObstacleSimple } from './taux-reussite';

/**
 * Faits objectifs agrégés d'une séance (couche objective, §1). `hauteur_max` est
 * la hauteur de tête de l'entrée ; `efforts_propres / efforts_totaux` la fraction
 * réussie (§7) ; `taux_réussite` son ratio borné [0, 1] (`null` si non
 * calculable) ; `sans_faute` vrai si **aucune** barre ni refus sur la séance.
 */
export interface FaitsSéance {
  hauteur_max: number;
  efforts_totaux: number;
  efforts_propres: number;
  taux_réussite: number | null;
  sans_faute: boolean;
}

interface Effort {
  hauteur: number;
  efforts: number;
  fautes: number;
}

function obstacleEffort(o: ObstacleFranchissement): Effort {
  const éléments = estCombinaison(o.type) ? Math.max(1, o.nombre_d_éléments ?? 1) : 1;
  const efforts = Math.max(0, o.répétitions) * éléments;
  const fautes = Math.max(0, o.barres) + Math.max(0, o.refus);
  return { hauteur: o.hauteur, efforts, fautes };
}

function tourEffort(t: TourFranchissement): Effort {
  return { hauteur: t.hauteur, efforts: 1, fautes: Math.max(0, t.barres) + Math.max(0, t.refus) };
}

/**
 * Calcule les faits objectifs d'une séance, ou **`null`** quand il n'y a rien à
 * résumer (séance sans obstacle ni tour : un **Plat** → entrée de **régularité**,
 * Modèle §3 ; pas de hauteur/fautes à afficher). L'appelant (api `feed`) lit ce
 * `null` comme « entrée de régularité ».
 */
export function faitsSéance(input: {
  obstacles: ObstacleFranchissement[];
  tours: TourFranchissement[];
}): FaitsSéance | null {
  const efforts: Effort[] = [
    ...input.obstacles.map(obstacleEffort),
    ...input.tours.map(tourEffort),
  ];
  if (efforts.length === 0) return null;

  const hauteur_max = Math.max(...efforts.map((e) => e.hauteur));
  const efforts_totaux = efforts.reduce((s, e) => s + e.efforts, 0);
  const fautes_totales = efforts.reduce((s, e) => s + e.fautes, 0);
  // Numérateur §7 borné par unité (une unité sur-fautée ne soustrait pas au-delà
  // de ses propres efforts) puis agrégé.
  const efforts_propres = efforts.reduce((s, e) => s + Math.max(0, e.efforts - e.fautes), 0);

  // Taux via la formule du §7 (réutilisée, jamais réimplémentée) : sur les
  // efforts/fautes agrégés. `null` si aucun effort (séance vide déjà écartée).
  const taux_réussite = tauxObstacleSimple({
    répétitions: efforts_totaux,
    barres: efforts_totaux - efforts_propres,
    refus: 0,
  });

  return {
    hauteur_max,
    efforts_totaux,
    efforts_propres,
    taux_réussite,
    sans_faute: fautes_totales === 0,
  };
}
