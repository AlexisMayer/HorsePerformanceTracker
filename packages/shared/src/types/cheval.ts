import type { NiveauCheval } from '../enums/cheval';
import type { ChampsTechniques } from './champs-techniques';

/**
 * Cheval (Modèle §3). Appartient à un seul compte en v1 : un demi-pensionnaire
 * suit sa propre fiche, à l'historique indépendant.
 *
 * `hauteur_de_référence` est déclarative (cm, sur un cran du référentiel §0).
 *
 * `archivé` (lot 4.3, Spec §9.2) : un cheval archivé (vendu/parti) passe en
 * **lecture seule**, conserve son historique, **sort de la liste active et du
 * quota**, et reste **réversible**. Requis (`NOT NULL DEFAULT false` en base) —
 * tout cheval naît actif.
 */
export interface Cheval extends ChampsTechniques {
  compte_id: string;
  nom: string;
  niveau: NiveauCheval;
  hauteur_de_référence: number;
  âge?: number;
  race?: string;
  archivé: boolean;
}
