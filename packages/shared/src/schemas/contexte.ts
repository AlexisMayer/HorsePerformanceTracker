import { z } from 'zod';
import { champsTechniquesSortie } from './champs-techniques';
import { échelle1à5Schema } from './referentiel';

/**
 * DTO d'**entrée** — contexte de séance, couche qualitative (Modèle §3).
 * Tous les champs sont optionnels ; aucun n'est jamais agrégé en métrique (§1).
 */
export const contexteCréerSchema = z.object({
  ressenti_global: échelle1à5Schema.optional(),
  énergie: échelle1à5Schema.optional(),
  note: z.string().max(2000).optional(),
});

export type ContexteCréerDto = z.infer<typeof contexteCréerSchema>;

/**
 * DTO de **sortie** — projection du contexte persisté, couche qualitative
 * (Modèle §1/§3, 0..1 par séance). Champs optionnels rendus en `null`. Aucune de
 * ces valeurs n'est jamais agrégée en métrique (§1). Réutilisé par l'export
 * RGPD (lot 1.3).
 */
export const contexteSortieSchema = z.object({
  ...champsTechniquesSortie,
  seance_id: z.string(),
  ressenti_global: z.number().nullable(),
  énergie: z.number().nullable(),
  note: z.string().nullable(),
});

export type ContexteSortie = z.infer<typeof contexteSortieSchema>;
