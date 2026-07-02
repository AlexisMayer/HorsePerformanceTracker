import { z } from 'zod';
import { NIVEAUX_CHEVAL } from '../enums/cheval';
import { TIERS, TYPES_COMPTE } from '../enums/compte';
import { estHauteurValide, HAUTEUR_MAX_CM, HAUTEUR_MIN_CM } from '../enums/hauteurs';
import { TYPES_JALON } from '../enums/jalon';
import { TYPES_OBSTACLE, TYPES_OBSTACLE_SIMPLE } from '../enums/obstacle';
import { PROVENANCES, TYPES_SEANCE } from '../enums/seance';
import { TENDANCES } from '../enums/tendance';

/**
 * Schémas Zod du référentiel (Modèle §0). Les valeurs proviennent des enums :
 * `shared` reste la source de vérité unique, aucune liste n'est redéclarée ici.
 */

export const tierSchema = z.enum(TIERS);
export const typeCompteSchema = z.enum(TYPES_COMPTE);
export const niveauChevalSchema = z.enum(NIVEAUX_CHEVAL);
export const typeObstacleSchema = z.enum(TYPES_OBSTACLE);
export const typeObstacleSimpleSchema = z.enum(TYPES_OBSTACLE_SIMPLE);
export const typeSéanceSchema = z.enum(TYPES_SEANCE);
export const provenanceSchema = z.enum(PROVENANCES);
export const typeJalonSchema = z.enum(TYPES_JALON);
/** Sens d'une trajectoire dérivée (bilan 4.4, benchmark 5.2) — `hausse`/`stable`/`baisse`. */
export const tendanceSchema = z.enum(TENDANCES);

/** Hauteur valide : entière, sur un cran du slider (60→160 cm, pas de 5). */
export const hauteurSchema = z
  .number()
  .int()
  .refine(estHauteurValide, {
    message: `Hauteur invalide : attendue entre ${HAUTEUR_MIN_CM} et ${HAUTEUR_MAX_CM} cm, par pas de 5.`,
  });

/** Compteur de fautes (barres / refus) : entier ≥ 0, défaut 0. */
export const compteurFautesSchema = z.number().int().nonnegative().default(0);

/** Échelle qualitative 1-5 (ressenti, énergie, difficulté). */
export const échelle1à5Schema = z.number().int().min(1).max(5);
