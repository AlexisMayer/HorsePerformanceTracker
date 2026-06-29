import {
  détecteJalons,
  hauteurMaîtrisée,
  type MaîtriseDto,
  type Métriques,
  métriquesSchema,
  type ObstacleFranchissement,
  type ObstacleSortie,
  recordAbsolu,
  type SéanceJalonInput,
  type SéanceSortie,
  type Vitrine,
} from '@hpt/shared';
import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Service de domaine **`metrics`** (lot 3.2, Architecture §3) — **surface de
 * lecture/composition** des **deux graphes héros** (Spec §5.2) : il **compose**
 * la courbe de **hauteur maîtrisée** (+ chiffre courant) et la **vitrine à
 * records/jalons**, il n'écrit **aucune** entité. Il lit l'historique d'un cheval
 * **via le service `sessions`** (`listForHorse`, qui scope au compte et vérifie la
 * propriété — jamais en lisant ses tables, Architecture §1/§3), puis dérive :
 *
 *  - la **hauteur maîtrisée** (§10, plancher conservateur fenêtré qui peut
 *    redescendre) via `hauteurMaîtrisée` de `shared` — **une seule**
 *    implémentation, qui réutilise les franchissements propres de 3.1 ;
 *  - le **record absolu gravé** (§5.5) et les **jalons** (records / premières
 *    fois) via `recordAbsolu` / `détecteJalons` de `shared` — la **détection
 *    record/jalon posée en 3.1**, réutilisée pour la vitrine (jamais réimplémentée).
 *
 * **Aucun calcul n'est implémenté ici** (Architecture §2) : le module ne fait
 * qu'**orchestrer** les fonctions pures de `shared`. Seules les séances **`live`**
 * alimentent les métriques (Modèle §2) ; le `déclaratif` et le **Plat** (0
 * hauteur) sont **exclus des agrégats** par les fonctions pures elles-mêmes.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * Compose les métriques héros d'un cheval **du compte courant** (404 si
   * étranger, levé par `sessions`/`horses`). La maîtrisée est dérivée de
   * l'historique `live` fenêtré ; le record absolu de **tout** l'historique `live`
   * (jamais effacé par une baisse de la maîtrisée, §5.5).
   */
  async compose(compteId: string, chevalId: string): Promise<Métriques> {
    // Lecture via le service sessions (gardien de la propriété) : un cheval
    // étranger ⇒ 404 sans fuite. Ordre chronologique croissant.
    const séances = await this.sessions.listForHorse(compteId, chevalId);
    const dérivées = séances.map(toJalonInput);

    // Héros 1 — hauteur maîtrisée (plancher fiable + grand chiffre courant). Le
    // record absolu sert de référence laiton au-dessus de la barre maîtrisée (§2).
    const { courante, série } = hauteurMaîtrisée(dérivées);
    const record = recordAbsolu(dérivées);
    const maîtrise: MaîtriseDto = {
      courante,
      record: record?.hauteur ?? null,
      série,
    };

    // Héros 2 — vitrine à records/jalons (réutilise la détection de 3.1).
    const vitrine: Vitrine = {
      record,
      jalons: détecteJalons(dérivées),
    };

    // Validation/strip au bord (Architecture §5) : la forme sortante est garantie.
    return métriquesSchema.parse({
      cheval_id: chevalId,
      maîtrise,
      vitrine,
    } satisfies Métriques);
  }
}

/** Projette un obstacle persisté vers la forme réduite des dérivés (§7/§10). */
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
 * Projette une séance persistée vers l'entrée des dérivés `shared` (§2/§10) —
 * `provenance` pilote l'exclusion du `déclaratif`, `date` l'ordre chronologique
 * (et la fenêtre de maîtrise), `id` le rattachement des jalons. Glue de lecture
 * (mapping de champs, pas de calcul), miroir de celle du feed (3.1).
 */
function toJalonInput(s: SéanceSortie): SéanceJalonInput {
  return {
    id: s.id,
    date: s.date,
    provenance: s.provenance,
    obstacles: s.obstacles.map(toFranchissementObstacle),
    tours: s.tours.map((t) => ({ hauteur: t.hauteur, barres: t.barres, refus: t.refus })),
  };
}
