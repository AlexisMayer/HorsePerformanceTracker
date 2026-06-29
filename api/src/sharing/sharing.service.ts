import {
  type CarteBilan,
  carteBilanSchema,
  détecteJalons,
  type ObstacleFranchissement,
  type ObstacleSortie,
  résuméCarte,
  type SéanceJalonInput,
  type SéanceSortie,
} from '@hpt/shared';
import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Service de domaine **`sharing`** (lot 3.3, Architecture §3) — **surface de
 * lecture/composition** des **cartes partageables** (Spec §5.4) : il **compose**
 * les données d'une carte de bilan de séance simple, il n'écrit **aucune** entité.
 * Il lit la séance **via le service `sessions`** (`findOne`/`listForHorse`, qui
 * scopent au compte et vérifient la propriété — jamais en lisant ses tables,
 * Architecture §1/§3), puis dérive :
 *
 *  - le **récap** de la séance (types travaillés, hauteurs, taux) via `résuméCarte`
 *    de `shared` (§7/§9), qui réutilise `faitsSéance` posé en 3.1 ;
 *  - la **mise en avant d'un record** via `détecteJalons` de `shared` — la
 *    détection record/jalon **posée en 3.1**, déjà réutilisée par la vitrine
 *    `metrics` (3.2) ; ici on garde le record **rattaché à cette séance**.
 *
 * **Aucun calcul n'est implémenté ici** (Architecture §2) : le module ne fait
 * qu'**orchestrer** les fonctions pures de `shared` — la carte et le feed/la
 * vitrine ne peuvent pas afficher des taux/records divergents (même source). Une
 * séance `déclaratif` **n'engendre aucun record** (§2, géré par `détecteJalons`) :
 * sa carte reste un récap simple, sans fausse célébration.
 *
 * **Carte de séance simple uniquement** (gratuite, tous comptes — §8) : pas de
 * génération IA (bilan augmenté 4.5), pas de PDF/multi-séances (bilan de
 * progression 4.4). Trois objets distincts (Spec §8).
 */
@Injectable()
export class SharingService {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * Compose la carte de bilan d'**une** séance **du compte courant** (404 si
   * étrangère, levé par `sessions`/`horses`). Le récap dérive de la séance ; le
   * record est dérivé de **tout** l'historique `live` du cheval (un record est
   * relatif à l'historique, pas à une séance isolée — Modèle §10).
   */
  async composeCarte(compteId: string, seanceId: string): Promise<CarteBilan> {
    // Charge la séance ciblée (gardien de la propriété : 404 sans fuite si
    // étrangère). Donne le cheval, donc l'historique à interroger pour le record.
    const séance = await this.sessions.findOne(compteId, seanceId);

    // Récap objectif de la séance (types, hauteurs, taux) — fonction pure `shared`.
    const résumé = résuméCarte({
      obstacles: séance.obstacles.map(toFranchissementObstacle),
      tours: séance.tours.map(toFranchissementTour),
    });

    // Record éventuel : on dérive les jalons de TOUT l'historique live du cheval
    // (le déclaratif est exclu par la fonction pure, §2) et on retient le record
    // rattaché à CETTE séance, s'il existe.
    const historique = await this.sessions.listForHorse(compteId, séance.cheval_id);
    const jalons = détecteJalons(historique.map(toJalonInput));
    const record =
      jalons.find((j) => j.seance_id === seanceId && j.type === 'record')?.hauteur ?? null;

    // Validation/strip au bord (Architecture §5) : la forme sortante est garantie.
    return carteBilanSchema.parse({
      seance_id: séance.id,
      cheval_id: séance.cheval_id,
      date: séance.date,
      type: séance.type,
      types_travaillés: résumé.types_travaillés,
      hauteurs: résumé.hauteurs,
      faits: résumé.faits,
      record,
    } satisfies CarteBilan);
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

/** Projette un tour persisté vers la forme réduite des dérivés (§10). */
function toFranchissementTour(t: SéanceSortie['tours'][number]) {
  return { hauteur: t.hauteur, barres: t.barres, refus: t.refus };
}

/**
 * Projette une séance persistée vers l'entrée de `détecteJalons` (§2/§10) —
 * `provenance` pilote l'exclusion du `déclaratif`, `date` l'ordre chronologique,
 * `id` le rattachement des jalons. Glue de lecture (mapping de champs, pas de
 * calcul), miroir de celle du feed (3.1) et de `metrics` (3.2).
 */
function toJalonInput(s: SéanceSortie): SéanceJalonInput {
  return {
    id: s.id,
    date: s.date,
    provenance: s.provenance,
    obstacles: s.obstacles.map(toFranchissementObstacle),
    tours: s.tours.map(toFranchissementTour),
  };
}
