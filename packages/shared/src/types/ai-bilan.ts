import type { ChampsTechniques } from './champs-techniques';

/**
 * **Bilan augmenté** (assistant IA — Modèle §3, lot 4.5). Entité **spécifiée au
 * Modèle de données** mais **non créée en 0.3** (6 entités socle) : le lot 4.5
 * ajoute la table (migration Drizzle) et **back-documente** l'entité (cf.
 * journal). C'est un **texte consultatif**, jamais une métrique (Modèle §1) :
 * il ne nourrit **aucune** courbe ni agrégat.
 *
 * Forme de **domaine normalisée** (miroir fidèle de la ligne persistée, vérifié
 * par `alignment.spec.ts`). La projection **de sortie** (contenu regroupé +
 * `disclaimer`) vit dans le DTO `schemas/ai-bilan.ts`.
 *
 * - `seance_id` : la séance analysée (**1 Séance**, unicité en base : un seul
 *   bilan augmenté par séance → relu sans régénération, Spec §7.3).
 * - `date_génération` : quand le bilan a été **généré** (date métier, distincte
 *   des horodatages techniques `created_at`/`updated_at`).
 * - `modèle` / `version` : le modèle Mistral **épinglé** utilisé (jamais `-latest`,
 *   Stack §3.6) — tracés pour l'auditabilité et la reproductibilité.
 * - `analyse` : bilan de la **dernière séance** (texte).
 * - `recommandations` : conseils pour la **prochaine** séance (texte).
 */
export interface BilanAugmenté extends ChampsTechniques {
  seance_id: string;
  date_génération: Date;
  modèle: string;
  version: string;
  analyse: string;
  recommandations: string;
}
