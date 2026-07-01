import { faitsSéance, type SéanceSortie } from '@hpt/shared';
import type { ContexteBilanIA, SéanceContexteIA } from './mistral.port';

/**
 * Construction **pure** du contexte envoyé à l'IA (lot 4.5, Spec §7.2) — testable
 * sans DB ni réseau. On projette la séance analysée + les **dernières** séances
 * du même cheval en **matière narrative** : la couche **objective** (faits, via
 * `faitsSéance` de `shared` — jamais réimplémenté, Architecture §2) **et** la
 * couche **contexte qualitatif** (ressenti/énergie/note). C'est **autorisé** ici
 * car la sortie est un **texte consultatif**, pas un agrégat (Modèle §1).
 */

/** Combien de séances **précédentes** joindre comme matière de comparaison. */
export const MAX_SÉANCES_PRÉCÉDENTES = 5;

/** Projette une séance en matière narrative (objectif + contexte qualitatif). */
function versContexte(séance: SéanceSortie): SéanceContexteIA {
  // Faits objectifs dérivés par `shared` (même dérivation que le fil/l'historique).
  const faits = faitsSéance({
    obstacles: séance.obstacles.map((o) => ({
      type: o.type,
      hauteur: o.hauteur,
      répétitions: o.répétitions,
      barres: o.barres,
      refus: o.refus,
      nombre_d_éléments: o.nombre_d_éléments,
    })),
    tours: séance.tours.map((t) => ({ hauteur: t.hauteur, barres: t.barres, refus: t.refus })),
  });
  return {
    date: séance.date instanceof Date ? séance.date.toISOString() : String(séance.date),
    type: séance.type,
    provenance: séance.provenance,
    hauteur_max: faits?.hauteur_max ?? null,
    efforts_propres: faits?.efforts_propres ?? null,
    efforts_totaux: faits?.efforts_totaux ?? null,
    taux_réussite: faits?.taux_réussite ?? null,
    sans_faute: faits?.sans_faute ?? null,
    // Couche contexte (matière narrative, jamais agrégée — Modèle §1).
    ressenti_global: séance.contexte?.ressenti_global ?? null,
    énergie: séance.contexte?.énergie ?? null,
    note: séance.contexte?.note ?? null,
  };
}

/**
 * Assemble le contexte pour la séance `cible` parmi l'historique `séances`
 * (celui du même cheval). La **dernière** = la séance analysée ; les
 * **précédentes** = jusqu'à `MAX_SÉANCES_PRÉCÉDENTES` séances **antérieures ou
 * concomitantes** (par date, plus récentes d'abord), la cible exclue.
 */
export function construireContexteBilan(
  séances: SéanceSortie[],
  cible: SéanceSortie,
): ContexteBilanIA {
  const dateCible = new Date(cible.date).getTime();
  const précédentes = séances
    .filter((s) => s.id !== cible.id && new Date(s.date).getTime() <= dateCible)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_SÉANCES_PRÉCÉDENTES)
    .map(versContexte);

  return { dernière: versContexte(cible), précédentes };
}
