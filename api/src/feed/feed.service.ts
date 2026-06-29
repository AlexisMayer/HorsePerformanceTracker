import {
  détecteJalons,
  type EntréeFeed,
  type FeedQuery,
  type Fil,
  faitsSéance,
  filSchema,
  type ObstacleFranchissement,
  type ObstacleSortie,
  type SéanceJalonInput,
  type SéanceSortie,
} from '@hpt/shared';
import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Service de domaine **`feed`** (lot 3.1, Architecture §3) — **surface de
 * lecture/composition** : il **compose** le fil mono-cheval, il n'écrit **aucune**
 * entité. Il lit l'historique d'un cheval **via le service `sessions`**
 * (`listForHorse`, qui scope au compte et vérifie la propriété — jamais en lisant
 * ses tables, Architecture §1/§3), puis dérive :
 *
 *  - les **faits objectifs** de chaque séance (couche objective, §1) via
 *    `faitsSéance` de `shared` (§7/§9) ;
 *  - les **jalons** (records / premières fois) via `détecteJalons` de `shared`
 *    (§10) — **une seule** implémentation, partagée avec la vitrine 3.2 ;
 *  - les **entrées de régularité** (Plat, 0 obstacle : faits `null`).
 *
 * **Aucun calcul n'est implémenté ici** (Architecture §2) : le module ne fait
 * qu'orchestrer les fonctions pures de `shared`. La couche **contexte**
 * (ressenti, note, difficulté) n'est **jamais agrégée** — elle décore l'entrée
 * en légende (§1). Les séances `déclaratif` **apparaissent** dans le fil mais ne
 * génèrent **ni record ni jalon** (§2, géré par `détecteJalons`).
 */
@Injectable()
export class FeedService {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * Compose le fil d'un cheval **du compte courant** (404 si étranger, levé par
   * `sessions`/`horses`). Les jalons sont dérivés de l'historique `live`
   * **complet** ; la pagination ne tranche que les **séances affichées** (récent
   * → ancien), pas le calcul des dérivés.
   */
  async compose(compteId: string, chevalId: string, query: FeedQuery): Promise<Fil> {
    // Lecture via le service sessions (ordre chronologique croissant) — gardien
    // de la propriété : un cheval étranger ⇒ 404 sans fuite.
    const séances = await this.sessions.listForHorse(compteId, chevalId);

    // Jalons dérivés de TOUT l'historique (le live seul est retenu par la
    // fonction pure ; le déclaratif est exclu des dérivés, §2).
    const jalons = détecteJalons(séances.map(toJalonInput));
    const jalonsParSéance = groupBy(jalons, (j) => j.seance_id);

    // Fil récent → ancien.
    const ordonnées = [...séances].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Pagination simple par curseur sur la date (séances strictement plus
    // anciennes que `before`), plafonnée à `limit` séances.
    const borne = query.before ? new Date(query.before).getTime() : null;
    const éligibles =
      borne === null ? ordonnées : ordonnées.filter((s) => s.date.getTime() < borne);
    const page = éligibles.slice(0, query.limit);
    const hasMore = éligibles.length > page.length;
    const nextBefore = hasMore ? (page[page.length - 1]?.date.toISOString() ?? null) : null;

    // Chaque séance devient une entrée (faits en avant), suivie de ses jalons
    // injectés (célébration adjacente à la séance live qui les a générés).
    const entrées: EntréeFeed[] = [];
    for (const s of page) {
      entrées.push(toEntréeSéance(s));
      for (const j of jalonsParSéance.get(s.id) ?? []) {
        entrées.push({
          kind: 'jalon',
          seance_id: j.seance_id,
          date: j.date,
          type_jalon: j.type,
          hauteur: j.hauteur,
        });
      }
    }

    // Validation/strip au bord (Architecture §5) : la forme sortante est garantie.
    return filSchema.parse({
      cheval_id: chevalId,
      entrées,
      next_before: nextBefore,
      has_more: hasMore,
    } satisfies Fil);
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

/** Projette une séance persistée vers l'entrée de `détecteJalons` (§2/§10). */
function toJalonInput(s: SéanceSortie): SéanceJalonInput {
  return {
    id: s.id,
    date: s.date,
    provenance: s.provenance,
    obstacles: s.obstacles.map(toFranchissementObstacle),
    tours: s.tours.map((t) => ({ hauteur: t.hauteur, barres: t.barres, refus: t.refus })),
  };
}

/**
 * Construit l'entrée de feed d'une séance : **séance** (faits objectifs) ou
 * **régularité** (Plat / 0 franchissement → faits `null`, Modèle §3). Le contexte
 * (0..1) reste en légende dans les deux cas (§1).
 */
function toEntréeSéance(s: SéanceSortie): EntréeFeed {
  const faits = faitsSéance({
    obstacles: s.obstacles.map(toFranchissementObstacle),
    tours: s.tours.map((t) => ({ hauteur: t.hauteur, barres: t.barres, refus: t.refus })),
  });
  const commun = {
    seance_id: s.id,
    date: s.date,
    date_modification: s.date_modification,
    provenance: s.provenance,
    type: s.type,
    contexte: s.contexte,
  };
  return faits === null ? { kind: 'régularité', ...commun } : { kind: 'séance', ...commun, faits };
}

/** Regroupe une liste par une clé dérivée (montage des jalons par séance). */
function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}
