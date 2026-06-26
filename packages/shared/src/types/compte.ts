import type { Tier, TypeCompte } from '../enums/compte';
import type { ChampsTechniques } from './champs-techniques';

/**
 * Compte utilisateur (Modèle §3).
 *
 * `password_hash` est un secret : il vit dans la forme de domaine mais ne doit
 * JAMAIS apparaître dans un DTO de sortie (voir `schemas/compte.ts`,
 * `compteSortieSchema`).
 */
export interface Compte extends ChampsTechniques {
  email: string;
  nom: string;
  password_hash: string;
  email_verified: boolean;
  type: TypeCompte;
  tier: Tier;
}
