import { z } from 'zod';
import { faitsSéanceSchema } from './feed';
import { typeObstacleSchema, typeSéanceSchema } from './referentiel';

/**
 * DTO de la **carte de bilan de séance simple** (lot 3.3, Spec §5.4, UI/UX §6.6).
 * Surface de **lecture/composition** : le module `sharing` lit la séance via le
 * service `sessions`, dérive le récap via `shared` (`résuméCarte` §7/§9, réutilisé
 * de 3.1) et la **mise en avant d'un record** via la détection de jalons (3.1,
 * réutilisée aussi par `metrics` 3.2). App et api partagent **exactement** cette
 * forme — aucun type dupliqué (Architecture §1/§2).
 *
 * **Carte de séance simple uniquement** (gratuite, tous comptes — §8) : à ne pas
 * confondre avec le **bilan augmenté IA** (4.5) ni le **bilan de progression**
 * (4.4). Aucune génération IA, aucun PDF, aucun multi-séances ici.
 */

/**
 * Données d'**une** carte partageable (`GET /sessions/:id/carte`). Le récap est la
 * couche objective de la séance (types travaillés, hauteurs, taux via `faits`) ;
 * `record` est la hauteur (cm) du record **battu par cette séance**, ou `null`
 * (pas de record → carte récap simple, **sans fausse célébration**). `faits` est
 * `null` pour une séance de régularité (Plat). Le **nom du cheval** et le **logo
 * HPT** sont la signature visuelle ajoutée par l'app (UI/UX §2/§6.6), pas un
 * dérivé : ils ne transitent pas par ce DTO.
 */
export const carteBilanSchema = z.object({
  seance_id: z.string(),
  cheval_id: z.string(),
  date: z.date(),
  type: typeSéanceSchema,
  /** Types d'obstacle travaillés (distincts, ordre du référentiel ; vide pour Plat/Concours). */
  types_travaillés: z.array(typeObstacleSchema),
  /** Hauteurs distinctes abordées (cm, ordre croissant ; vide pour un Plat). */
  hauteurs: z.array(z.number()),
  /** Faits objectifs (hauteur max, taux, sans-faute) ou `null` (régularité). */
  faits: faitsSéanceSchema.nullable(),
  /** Hauteur (cm) du record battu par cette séance, ou `null` (pas de record). */
  record: z.number().nullable(),
});

export type CarteBilan = z.infer<typeof carteBilanSchema>;
