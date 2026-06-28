import {
  type ContexteCréerDto,
  type ObstacleCréerDto,
  type SéanceCréerDto,
  type SéanceModifierDto,
  type SéanceSortie,
  séanceSortieSchema,
  type TourCréerDto,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { contexte, obstacle, seance, tour } from '../db/schema';
import { ChevalNotFoundError } from '../horses/horses.errors';
import { HorsesService } from '../horses/horses.service';
import { SéanceNotFoundError } from './sessions.errors';

/** Code SQLSTATE d'une violation de contrainte d'unicité (Postgres). */
const UNIQUE_VIOLATION = '23505';

/** Handle de transaction Drizzle (le `tx` passé au callback de `db.transaction`). */
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Contenu **mutable** d'une séance (ses unités atomiques) — sous-ensemble commun
 * à la création (`SéanceCréerDto`) et à l'édition (`SéanceModifierDto`). Sert à
 * factoriser l'écriture des enfants (une seule implémentation, partagée).
 */
interface SéanceUnités {
  obstacles?: ObstacleCréerDto[];
  tours?: TourCréerDto[];
  contexte?: ContexteCréerDto;
}

/** Regroupe une liste plate d'enfants par `seance_id` (montage de l'arbre). */
function groupBySeance<T extends { seance_id: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = map.get(item.seance_id);
    if (bucket) bucket.push(item);
    else map.set(item.seance_id, [item]);
  }
  return map;
}

/**
 * Service de domaine **`sessions`** (lot 2.2, Architecture §3) — **gardien de
 * l'inviolabilité** : **toute** écriture de séance passe par lui, qui pose
 * l'**horodatage** (`date`), la **provenance** et laisse `date_modification`
 * **null** à la création (Modèle §2). Première écriture serveur de la Phase 2
 * (Stack §4 : l'enregistrement est l'unique moment d'écriture).
 *
 * **Dépend de `horses`** (2.1) : toute opération **vérifie la propriété du
 * cheval** via `HorsesService` — jamais en lisant ses tables (Architecture §1).
 * Un cheval/une séance d'un autre compte se comporte comme inexistant (404, pas
 * de fuite). Aucune métrique calculée ici : on **persiste** la provenance ;
 * l'exclusion du `déclaratif` des agrégats est l'affaire de `metrics` (3.2).
 */
@Injectable()
export class SessionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly horses: HorsesService,
  ) {}

  /**
   * **Crée une séance** pour un cheval **du compte courant**, avec ses unités
   * atomiques (obstacles **ou** tours selon le type) et un contexte (0..1), en
   * **une transaction** (tout ou rien) — un enfant invalide n'écrit rien.
   *
   * **Idempotence** (Architecture §5, Stack §4) : la clé client est unique par
   * `(cheval_id, idempotency_key)`. Un réessai renvoie la séance déjà créée sans
   * doublon — vérifié en amont (chemin rapide) **et** rattrapé sur la violation
   * d'unicité (course concurrente).
   */
  async create(compteId: string, chevalId: string, dto: SéanceCréerDto): Promise<SéanceSortie> {
    // Propriété du cheval (lève ChevalNotFoundError → 404 si étranger au compte).
    await this.horses.findOne(compteId, chevalId);

    // Chemin rapide : un réessai (même clé) renvoie la séance existante.
    const existing = await this.findByIdempotencyKey(chevalId, dto.idempotency_key);
    if (existing) return existing;

    try {
      const seanceId = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(seance)
          .values({
            cheval_id: chevalId,
            type: dto.type,
            // Horodatage posé à l'enregistrement ; `date_modification` reste null.
            date: new Date(),
            provenance: dto.provenance,
            idempotency_key: dto.idempotency_key,
          })
          .returning({ id: seance.id });
        const id = row.id;
        await this.insertUnits(tx, id, dto);
        return id;
      });

      return this.loadTreeById(seanceId);
    } catch (error) {
      // Course concurrente sur la même clé : la contrainte d'unicité a parlé →
      // on renvoie la séance gagnante, toujours sans doublon.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        const winner = await this.findByIdempotencyKey(chevalId, dto.idempotency_key);
        if (winner) return winner;
      }
      throw error;
    }
  }

  /**
   * Liste les séances d'un cheval **du compte courant** (ordre chronologique de
   * la `date` métier), chacune avec ses unités atomiques imbriquées. Lecture
   * brute suffisante pour prouver la persistance — le feed riche est le lot 3.1.
   */
  async listForHorse(compteId: string, chevalId: string): Promise<SéanceSortie[]> {
    await this.horses.findOne(compteId, chevalId);
    const rows = await this.db
      .select()
      .from(seance)
      .where(eq(seance.cheval_id, chevalId))
      .orderBy(seance.date);
    return this.assembleTrees(rows);
  }

  /**
   * Détail d'une séance **scopée au compte** (404 sinon, sans fuite). La séance
   * est lue dans la table du module (`sessions`) ; la **propriété** est vérifiée
   * via `horses` (jamais en lisant sa table) — toute séance non possédée devient
   * un 404 `SéanceNotFoundError`.
   */
  async findOne(compteId: string, seanceId: string): Promise<SéanceSortie> {
    const row = await this.loadOwned(compteId, seanceId);
    const [tree] = await this.assembleTrees([row]);
    return tree;
  }

  /**
   * **Édite** une séance **du compte courant** (lot 2.4, Spec §3.7) — le service
   * `sessions` est le gardien de l'inviolabilité (Modèle §2) : il **pose
   * `date_modification = now`** (l'édition n'est **jamais silencieuse**) et laisse
   * **`date` immuable** (jamais réécrite), ainsi que `provenance` et
   * `idempotency_key`. Les séances `déclaratives` suivent les mêmes règles.
   *
   * **Sémantique de remplacement, en une transaction** : la collection
   * (obstacles **ou** tours) et le contexte sont **remplacés** d'un bloc
   * (`type ↔ structure` revérifié par le service via la même écriture que la
   * création). Aucun **dérivé** (taux, hauteur maîtrisée, records — Modèle §9/§10)
   * n'étant stocké, il n'y a **aucun agrégat à corriger** : le prochain calcul
   * dérive mécaniquement de l'historique courant.
   *
   * L'**idempotence (2.2) ne contourne pas l'édition** : un re-`POST` avec la même
   * clé renvoie la séance existante **inchangée** ; modifier passe **forcément**
   * par cette route.
   */
  async update(compteId: string, seanceId: string, dto: SéanceModifierDto): Promise<SéanceSortie> {
    await this.loadOwned(compteId, seanceId);

    await this.db.transaction(async (tx) => {
      // Remplace les unités atomiques : on purge les enfants existants puis on
      // réécrit la collection cible (aucun dérivé stocké à réconcilier).
      await tx.delete(obstacle).where(eq(obstacle.seance_id, seanceId));
      await tx.delete(tour).where(eq(tour.seance_id, seanceId));
      await tx.delete(contexte).where(eq(contexte.seance_id, seanceId));

      await tx
        .update(seance)
        .set({
          type: dto.type,
          // Édition jamais silencieuse : on trace la modification. `date`,
          // `provenance` et `idempotency_key` restent volontairement intouchés.
          date_modification: new Date(),
        })
        .where(eq(seance.id, seanceId));

      await this.insertUnits(tx, seanceId, dto);
    });

    return this.loadTreeById(seanceId);
  }

  /**
   * **Supprime** une séance **du compte courant** (lot 2.4, Spec §3.7) — **purge
   * dure en cascade** : la FK `ON DELETE CASCADE` posée en 0.3 (`Séance →
   * {Obstacle, Tour, Contexte}`) emporte toutes ses unités atomiques. **Pas de
   * soft delete** (cohérent 1.3). Ses contributions aux métriques/records
   * disparaissent **par construction** : rien n'est stocké, donc rien à
   * décrémenter (Modèle §9/§10). 404 si la séance n'appartient pas au compte.
   */
  async remove(compteId: string, seanceId: string): Promise<void> {
    await this.loadOwned(compteId, seanceId);
    await this.db.delete(seance).where(eq(seance.id, seanceId));
  }

  /**
   * Écrit les **unités atomiques** d'une séance (obstacles **ou** tours selon le
   * type, contexte 0..1) dans la transaction courante. **Une seule
   * implémentation**, partagée par la création (2.2) et l'édition (2.4).
   */
  private async insertUnits(tx: Transaction, seanceId: string, dto: SéanceUnités): Promise<void> {
    if (dto.obstacles && dto.obstacles.length > 0) {
      await tx.insert(obstacle).values(
        dto.obstacles.map((o) => ({
          seance_id: seanceId,
          type: o.type,
          hauteur: o.hauteur,
          répétitions: o.répétitions,
          barres: o.barres,
          refus: o.refus,
          difficulté: o.difficulté ?? null,
          nombre_d_éléments: o.nombre_d_éléments ?? null,
          éléments: o.éléments ?? null,
        })),
      );
    }

    if (dto.tours && dto.tours.length > 0) {
      await tx.insert(tour).values(
        dto.tours.map((t) => ({
          seance_id: seanceId,
          hauteur: t.hauteur,
          barres: t.barres,
          refus: t.refus,
        })),
      );
    }

    if (dto.contexte) {
      await tx.insert(contexte).values({
        seance_id: seanceId,
        ressenti_global: dto.contexte.ressenti_global ?? null,
        énergie: dto.contexte.énergie ?? null,
        note: dto.contexte.note ?? null,
      });
    }
  }

  /**
   * Charge une séance **possédée par le compte** (404 sinon, sans fuite). Lue dans
   * la table du module, sa **propriété** est vérifiée via `horses` (jamais en
   * lisant sa table, Architecture §1) ; toute séance étrangère devient un 404
   * `SéanceNotFoundError`. Base du scoping pour lecture/édition/suppression.
   */
  private async loadOwned(compteId: string, seanceId: string): Promise<typeof seance.$inferSelect> {
    const [row] = await this.db.select().from(seance).where(eq(seance.id, seanceId)).limit(1);
    if (!row) throw new SéanceNotFoundError();
    try {
      await this.horses.findOne(compteId, row.cheval_id);
    } catch (error) {
      if (error instanceof ChevalNotFoundError) throw new SéanceNotFoundError();
      throw error;
    }
    return row;
  }

  /** Cherche une séance par sa clé d'idempotence (scopée au cheval), ou `null`. */
  private async findByIdempotencyKey(
    chevalId: string,
    idempotencyKey: string,
  ): Promise<SéanceSortie | null> {
    const [row] = await this.db
      .select()
      .from(seance)
      .where(and(eq(seance.cheval_id, chevalId), eq(seance.idempotency_key, idempotencyKey)))
      .limit(1);
    if (!row) return null;
    return this.loadTreeById(row.id);
  }

  /** Charge l'arbre complet d'une séance existante (par son id). */
  private async loadTreeById(seanceId: string): Promise<SéanceSortie> {
    const [row] = await this.db.select().from(seance).where(eq(seance.id, seanceId)).limit(1);
    const [tree] = await this.assembleTrees([row]);
    return tree;
  }

  /**
   * Monte l'arbre de sortie (séance + obstacles/tours/contexte) pour une liste de
   * lignes de séance, en **requêtes groupées** (`inArray`) puis assemblage en
   * mémoire — pas de N+1. Projeté via `séanceSortieSchema` : le `.strip()` retire
   * toute clé inattendue (dont la clé d'idempotence technique).
   */
  private async assembleTrees(seanceRows: (typeof seance.$inferSelect)[]): Promise<SéanceSortie[]> {
    if (seanceRows.length === 0) return [];
    const seanceIds = seanceRows.map((s) => s.id);

    const [obstacles, tours, contextes] = await Promise.all([
      this.db.select().from(obstacle).where(inArray(obstacle.seance_id, seanceIds)),
      this.db.select().from(tour).where(inArray(tour.seance_id, seanceIds)),
      this.db.select().from(contexte).where(inArray(contexte.seance_id, seanceIds)),
    ]);

    const obstaclesBySeance = groupBySeance(obstacles);
    const toursBySeance = groupBySeance(tours);
    const contexteBySeance = new Map(contextes.map((c) => [c.seance_id, c]));

    return seanceRows.map((s) =>
      séanceSortieSchema.parse({
        ...s,
        obstacles: obstaclesBySeance.get(s.id) ?? [],
        tours: toursBySeance.get(s.id) ?? [],
        contexte: contexteBySeance.get(s.id) ?? null,
      }),
    );
  }
}
