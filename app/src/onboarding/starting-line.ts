import type { SéanceCréerDto, TypeObstacle, TypeSéance } from '@hpt/shared';
import {
  clampHauteur,
  draftToCreateDto,
  emptyDraft,
  newObstacle,
  type SessionDraft,
} from '../sessions/draft';

/**
 * **Ligne de départ déclarative** (lot 3.5, Spec §2.2/§2.4, Modèle §2) — la
 * réponse à « quelle hauteur ton cheval franchit-il proprement aujourd'hui ? »
 * devient une **séance `déclaratif`**, marquée « antérieure à l'app » et **exclue
 * des agrégats** (elle nourrit le feed comme repère, jamais la maîtrisée/record).
 *
 * On **ne crée aucun nouveau contrat** : la ligne de départ est une séance
 * ordinaire posée via le service `sessions` (2.2, qui accepte déjà la provenance
 * `déclaratif`). On la modélise comme un **franchissement propre unique** à la
 * hauteur de référence — un obstacle simple, 1 répétition, **0 faute** (taux
 * 100 %). C'est le « point déclaratif » de départ. La projection réutilise
 * `draftToCreateDto` de la saisie 2.3 — **aucune logique dupliquée**
 * (Architecture §2).
 */

/** Type de séance de la ligne de départ (un entraînement à obstacles). */
export const STARTING_LINE_TYPE_SÉANCE: TypeSéance = 'Parcours';
/** Type de l'obstacle franchi proprement (un droit, le plus neutre). */
export const STARTING_LINE_TYPE_OBSTACLE: TypeObstacle = 'Vertical';

/**
 * Brouillon **pur** de la ligne de départ : un obstacle propre à la hauteur
 * donnée (bornée au référentiel §0, pas de 5). Réutilise les briques de brouillon
 * de la saisie 2.3 ; rien de spécifique à l'onboarding dans la *forme* de la
 * séance (seule sa **provenance** la distingue, posée à la projection).
 */
export function startingLineDraft(hauteur: number): SessionDraft {
  return {
    ...emptyDraft(STARTING_LINE_TYPE_SÉANCE),
    obstacles: [
      newObstacle({
        type: STARTING_LINE_TYPE_OBSTACLE,
        hauteur: clampHauteur(hauteur),
        répétitions: 1,
        barres: 0,
        refus: 0,
      }),
    ],
  };
}

/**
 * DTO d'entrée de la ligne de départ pour `POST /horses/:id/sessions` (2.2), avec
 * **provenance `déclaratif`** posée explicitement. La clé d'idempotence vient du
 * brouillon (stable) ; le serveur dédoublonne, donc un réessai ne crée pas de
 * doublon. À envoyer via `submitSession` (réessai résilient, 2.3).
 */
export function buildStartingLineDto(hauteur: number): SéanceCréerDto {
  return draftToCreateDto(startingLineDraft(hauteur), 'déclaratif');
}
