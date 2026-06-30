import {
  NIVEAUX_CHEVAL,
  PROVENANCES,
  STATUTS_ABONNEMENT,
  TIERS,
  TIERS_PAYANTS,
  TYPES_COMPTE,
  TYPES_OBSTACLE,
  TYPES_SEANCE,
} from '@hpt/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Enums Postgres des entités socle (décision figée du lot 0.3 : `pgEnum`, pas
 * de `CHECK`). Chaque enum **réutilise** le tuple figé de `@hpt/shared`
 * (référentiel Modèle §0) — il n'est jamais redéclaré ici, ce qui garantit que
 * les libellés en base sont exactement ceux du domaine (alignement §2).
 *
 * Convention de nommage : type Postgres préfixé par l'entité
 * (`compte_type`, `seance_provenance`, …) pour rester unique dans le schéma.
 * Les **valeurs** gardent leurs accents (ce sont des libellés du référentiel :
 * `Rivière`, `déclaratif`) ; seuls les **identifiants** sont en ASCII.
 */

export const compteTypeEnum = pgEnum('compte_type', TYPES_COMPTE);
export const compteTierEnum = pgEnum('compte_tier', TIERS);
export const chevalNiveauEnum = pgEnum('cheval_niveau', NIVEAUX_CHEVAL);
export const seanceTypeEnum = pgEnum('seance_type', TYPES_SEANCE);
export const seanceProvenanceEnum = pgEnum('seance_provenance', PROVENANCES);
export const obstacleTypeEnum = pgEnum('obstacle_type', TYPES_OBSTACLE);

/**
 * Enums de l'**abonnement** (lot 4.2) — réutilisent les tuples figés de
 * `@hpt/shared` (tiers payants premium/pro ; statuts du cycle Mollie/SEPA).
 * Comme les enums socle (0.3), les libellés en base sont exactement ceux du
 * domaine ; ils ne sont jamais redéclarés ici.
 */
export const abonnementTierEnum = pgEnum('abonnement_tier', TIERS_PAYANTS);
export const abonnementStatutEnum = pgEnum('abonnement_statut', STATUTS_ABONNEMENT);
