/**
 * **Aperçu de bilan — données de démonstration** (lot 3.5, Spec §2.3).
 *
 * Le chemin **coach** montre, **avant toute saisie réelle**, à quoi ressemble le
 * livrable client (le **bilan de progression**, Spec §6) — c'est le levier de
 * conversion principal. **Consigne forte** : ce n'est **pas** le générateur réel
 * (lot **4.4**). Ici, des **données statiques** purement illustratives, jamais
 * issues d'un calcul ni d'un cheval réel. Le **vrai** bilan se construira plus
 * tard sur la couche objective (`metrics` 3.2 + régularité), en 4.4.
 *
 * Module **pur** (aucun import React Native) : la donnée de démo est testée pour
 * rester cohérente (trajectoire croissante, record ≥ maîtrisée…).
 */

/** Donnée de démonstration d'un bilan de progression (sections clés, Spec §6.2). */
export interface BilanDemo {
  /** Identité (fiche cheval) — un nom d'exemple, jamais un cheval réel. */
  cheval: string;
  niveau: string;
  /** Période documentée (fenêtre d'exemple). */
  période: string;
  /** Régularité : le cœur du bilan (preuve du travail fourni, Spec §6.1). */
  séances: number;
  semaines: number;
  /** Niveau démontré : hauteur maîtrisée (cm) + record (cm). */
  maîtrisée: number;
  record: number;
  /** Trajectoire : points de hauteur maîtrisée (cm), croissants, pour la courbe. */
  trajectoire: readonly number[];
}

/**
 * Bilan de démo figé. Valeurs choisies pour **raconter une progression crédible**
 * (montée régulière 95 → 115, record gravé à 120) sans prétendre à l'exactitude :
 * un **exemple**, explicitement signalé comme tel à l'écran.
 */
export const BILAN_DEMO: BilanDemo = {
  cheval: 'Quibelle',
  niveau: 'Amateur',
  période: 'janvier – mars 2026',
  séances: 18,
  semaines: 12,
  maîtrisée: 115,
  record: 120,
  trajectoire: [95, 100, 100, 105, 110, 110, 115],
};

/**
 * Libellé accessible (lecteurs d'écran, §8) de la courbe de trajectoire — la
 * courbe elle-même est **décorative** (comme les héros 3.2). Sobre, sans drama.
 */
export function bilanDemoTrajectoireLabel(demo: BilanDemo): string {
  const { trajectoire } = demo;
  const min = Math.min(...trajectoire);
  const max = Math.max(...trajectoire);
  return `Trajectoire de démonstration : de ${min} à ${max} centimètres maîtrisés.`;
}
