import type { NiveauCheval } from '../enums/cheval';
import type { ChampsTechniques } from './champs-techniques';

/**
 * Cheval (Modèle §3). Appartient à un seul compte en v1 : un demi-pensionnaire
 * suit sa propre fiche, à l'historique indépendant.
 *
 * `hauteur_de_référence` est déclarative (cm, sur un cran du référentiel §0).
 */
export interface Cheval extends ChampsTechniques {
  compte_id: string;
  nom: string;
  niveau: NiveauCheval;
  hauteur_de_référence: number;
  âge?: number;
  race?: string;
}
