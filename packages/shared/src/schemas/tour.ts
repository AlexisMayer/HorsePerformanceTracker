import { z } from 'zod';
import { compteurFautesSchema, hauteurSchema } from './referentiel';

/**
 * DTO d'**entrée** — un tour de concours (Modèle §6.2). La hauteur est fixée
 * par l'épreuve ; `sans_faute` n'est pas saisi (dérivé, cf. `calc/sansFaute`).
 */
export const tourCréerSchema = z.object({
  hauteur: hauteurSchema,
  barres: compteurFautesSchema,
  refus: compteurFautesSchema,
});

export type TourCréerDto = z.infer<typeof tourCréerSchema>;
