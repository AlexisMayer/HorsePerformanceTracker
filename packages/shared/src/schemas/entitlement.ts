import { z } from 'zod';
import { CAPACITÉS, type Capacité, type CléQuota, QUOTAS } from '../entitlements/entitlement';
import { tierSchema } from './referentiel';

/**
 * DTO de **sortie** de l'entitlement (lot 4.1) — ce que l'api expose sur
 * `GET /me/entitlement` (Spec §9.3 : l'app lit l'entitlement au login). Forme
 * validée au bord (Architecture §5) ; types inférés, **aucun type dupliqué**.
 *
 * Les sous-objets `capacités` / `quotas` sont **dérivés des tuples**
 * `CAPACITÉS` / `QUOTAS` de la politique `shared` (pas de liste redéclarée) :
 * ajouter une capacité/un quota à la matrice étend automatiquement le schéma.
 * Un quota vaut `null` quand il est **illimité**.
 */
const capacitésShape = Object.fromEntries(CAPACITÉS.map((c) => [c, z.boolean()])) as Record<
  Capacité,
  z.ZodBoolean
>;

const quotasShape = Object.fromEntries(
  QUOTAS.map((q) => [q, z.number().int().nonnegative().nullable()]),
) as Record<CléQuota, z.ZodNullable<z.ZodNumber>>;

export const entitlementSortieSchema = z.object({
  tier: tierSchema,
  capacités: z.object(capacitésShape),
  quotas: z.object(quotasShape),
});

export type EntitlementSortie = z.infer<typeof entitlementSortieSchema>;
