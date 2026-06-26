import { z } from 'zod';
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
