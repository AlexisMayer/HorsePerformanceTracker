import { z } from 'zod';
import { séanceSortieSchema } from './seance';

/**
 * DTO de l'**historique mono-cheval** (lot 3.4, Spec §1/§8, UI/UX §6.4). L'onglet
 * Historique est une **surface app _sans module backend dédié_** (Architecture
 * §3/§4) : elle **lit les endpoints existants** du service `sessions` (séances
 * passées) et de `sharing` (carte de bilan simple, 3.3). Le **seul** ajout
 * backend est cette **liste paginée** des séances passées d'un cheval — il
 * manquait à `sessions` (le `GET /horses/:id/sessions` de 2.2 renvoie **tout**,
 * sans pagination, et reste inchangé).
 *
 * Forme volontairement **minimale** : une **page de séances brutes**
 * (`séanceSortieSchema`, réutilisé — aucun type dupliqué, Architecture §1/§2) +
 * un **curseur** de pagination simple, **identique** à celui du fil (3.1). La
 * composition de la vue (faits objectifs via `faitsSéance` de `shared`,
 * **groupement par mois**, badges de bilan) est faite **côté app** — c'est ce qui
 * fait de `history` une surface app sans module : le backend ne fait que
 * **paginer**, il ne compose pas. La **ré-ouverture** d'un bilan simple passe par
 * l'endpoint existant `GET /sessions/:id/card` (3.3).
 */

/**
 * Page d'historique : les séances **récent → ancien**, plus un **curseur** de
 * pagination simple. `next_before` est l'horodatage (ISO) à repasser en `before`
 * pour charger la tranche plus ancienne ; `null` quand il n'y a plus rien. Même
 * convention que le fil (3.1) — l'app pagine les deux surfaces à l'identique.
 */
export const pageHistoriqueSchema = z.object({
  cheval_id: z.string(),
  séances: z.array(séanceSortieSchema),
  next_before: z.string().nullable(),
  has_more: z.boolean(),
});

export type PageHistorique = z.infer<typeof pageHistoriqueSchema>;

/**
 * Query de pagination de l'historique (`GET /horses/:id/sessions/history`).
 * `before` (ISO) borne les séances **strictement plus anciennes** que ce
 * curseur ; `limit` plafonne le nombre de **séances** de la page. Validée au bord
 * (Architecture §5), bornes identiques au fil (3.1) pour un défilement cohérent.
 */
export const historiqueQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type HistoriqueQuery = z.infer<typeof historiqueQuerySchema>;
