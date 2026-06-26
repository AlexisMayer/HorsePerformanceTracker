/**
 * Champs techniques communs à toutes les entités persistées (Modèle §3).
 *
 * `id` est un identifiant opaque (UUID). `created_at` / `updated_at` sont des
 * horodatages techniques, distincts de la `date` *métier* d'une séance.
 * Le schéma Drizzle du lot 0.3 devra exposer ces colonnes pour chaque entité.
 */
export interface ChampsTechniques {
  id: string;
  created_at: Date;
  updated_at: Date;
}
