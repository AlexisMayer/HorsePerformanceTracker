import { z } from 'zod';
import { champsTechniquesSortie } from './champs-techniques';
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

/**
 * DTO de **sortie** — projection d'un tour persisté (Modèle §6.2). `sans_faute`
 * reste **dérivé** (jamais stocké, jamais projeté ici : il se calcule via
 * `calc/sansFaute`). Réutilisé par l'export RGPD (lot 1.3).
 */
export const tourSortieSchema = z.object({
  ...champsTechniquesSortie,
  seance_id: z.string(),
  hauteur: z.number(),
  barres: z.number(),
  refus: z.number(),
});

export type TourSortie = z.infer<typeof tourSortieSchema>;
