import { z } from 'zod';
import { tierSchema, typeCompteSchema } from './referentiel';

/**
 * DTO d'**entrée** — création d'un compte.
 *
 * On reçoit un `password` en clair (haché côté serveur en `password_hash`,
 * jamais transporté tel quel). `email_verified` est géré par le serveur, pas
 * fourni par le client.
 */
export const compteCréerSchema = z.object({
  email: z.string().email(),
  nom: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  type: typeCompteSchema,
  tier: tierSchema.default('gratuit'),
});

export type CompteCréerDto = z.infer<typeof compteCréerSchema>;

/**
 * DTO de **sortie** — projection publique d'un compte.
 *
 * Ne contient AUCUN champ sensible : ni `password_hash`, ni `password`. Le
 * `.strip()` par défaut de Zod retire toute clé inconnue, donc parser une
 * entité complète via ce schéma garantit que le secret ne fuit jamais.
 */
export const compteSortieSchema = z
  .object({
    id: z.string(),
    created_at: z.date(),
    updated_at: z.date(),
    email: z.string().email(),
    nom: z.string(),
    email_verified: z.boolean(),
    type: typeCompteSchema,
    tier: tierSchema,
  })
  .strip();

export type CompteSortie = z.infer<typeof compteSortieSchema>;
