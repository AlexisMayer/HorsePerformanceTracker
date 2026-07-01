import {
  agrègeHeatmap,
  type Heatmap,
  type HeatmapDto,
  heatmapSchema,
  type ObstacleFranchissement,
  type ObstacleSortie,
  type SéanceHeatmapInput,
  type SéanceSortie,
} from '@hpt/shared';
import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Service de domaine **`analytics`** (lot 5.1, Architecture §3) — **surface de
 * lecture/composition** du **diagnostic premium** : il **compose** la **heatmap
 * type × hauteur** (Spec §5.3, Modèle §9) d'un cheval, il n'écrit **aucune**
 * entité. Il lit l'historique **via le service `sessions`** (`listForHorse`, qui
 * scope au compte et vérifie la propriété — jamais ses tables, Architecture
 * §1/§3), puis agrège via `shared` :
 *
 *  - `agrègeHeatmap` **réutilise le taux §7** (`effortsObstacle`, décomposition en
 *    efforts propres/totaux) — **une seule** implémentation, jamais réécrite. La
 *    Combinaison est **sa propre ligne** (dénominateur × `nombre_d_éléments`, §9),
 *    **sans** la règle conservatrice §10 (réservée à la hauteur maîtrisée, 3.2).
 *
 * **Aucun calcul n'est implémenté ici** (Architecture §2) : le module ne fait
 * qu'**orchestrer** la fonction pure de `shared`. Seules les séances **`live`**
 * l'alimentent (Modèle §2, filtré par `shared`) ; le **Plat** (0 obstacle), le
 * **Concours** (des tours, sans type d'obstacle) et le **`déclaratif`** sont
 * **exclus** ; la **couche contexte n'est jamais agrégée** (Modèle §1).
 *
 * **Lecture per-cheval, réutilisable en aval** : la heatmap est composée pour **un
 * cheval** ; la structure est prête pour une **relecture en lecture seule scopée**
 * par les comptes invité (lot 4.6, qui dépendra de ce endpoint) — sans construire
 * le scoping ici. `AnalyticsService` est **exporté** à cette fin.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * Compose la **heatmap type × hauteur** d'un cheval **du compte courant** (404
   * si étranger, levé par `sessions`/`horses`). L'agrégat dérive de l'historique
   * `live` (obstacles d'entraînement) ; il est **validé/strippé au bord**
   * (Architecture §5) avant de sortir.
   */
  async heatmap(compteId: string, chevalId: string): Promise<HeatmapDto> {
    // Lecture via le service sessions (gardien de la propriété) : un cheval
    // étranger ⇒ 404 sans fuite.
    const séances = await this.sessions.listForHorse(compteId, chevalId);
    const heatmap: Heatmap = agrègeHeatmap(séances.map(toHeatmapInput));

    // Validation/strip au bord (Architecture §5) : la forme sortante est garantie.
    return heatmapSchema.parse({ cheval_id: chevalId, ...heatmap } satisfies HeatmapDto);
  }
}

/** Projette un obstacle persisté vers la forme réduite des dérivés (§7/§9). */
function toFranchissementObstacle(o: ObstacleSortie): ObstacleFranchissement {
  return {
    type: o.type,
    hauteur: o.hauteur,
    répétitions: o.répétitions,
    barres: o.barres,
    refus: o.refus,
    nombre_d_éléments: o.nombre_d_éléments,
  };
}

/**
 * Projette une séance persistée vers l'entrée de la heatmap `shared` (§2/§9) —
 * `provenance` pilote l'exclusion du `déclaratif` ; seuls les `obstacles`
 * d'entraînement sont retenus (les **tours** de concours n'ont pas de type
 * d'obstacle → jamais projetés ; le **Plat** n'a pas d'obstacle ; la **couche
 * contexte** n'est pas lue). Glue de lecture (mapping de champs, pas de calcul),
 * miroir de celle du feed (3.1) / des métriques (3.2).
 */
function toHeatmapInput(s: SéanceSortie): SéanceHeatmapInput {
  return {
    provenance: s.provenance,
    obstacles: s.obstacles.map(toFranchissementObstacle),
  };
}
