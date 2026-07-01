import {
  type ChevalCréerDto,
  type ChevalModifierDto,
  type ChevalSortie,
  chevalSortieSchema,
  type Tier,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { cheval } from '../db/schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ChevalArchivéError, ChevalNotFoundError } from './horses.errors';

/**
 * Service de domaine **`horses`** (lot 2.1, Architecture §3) : CRUD de la fiche
 * cheval, **scopé au compte authentifié**. Première entité métier détenue par
 * l'utilisateur (dépend de `auth-account`, lot 1.1, pour l'identité).
 *
 * **Modèle d'autorisation** : toute opération porte le `compteId` du jeton
 * d'accès et filtre par `compte_id` **dans la requête SQL**. Un compte ne peut
 * donc lire/éditer/supprimer que **ses** chevaux ; viser le cheval d'un autre
 * compte renvoie `ChevalNotFoundError` (404 sans fuite d'existence).
 *
 * Aucune dépendance HTTP ; lève des erreurs de domaine typées (Architecture §5).
 *
 * **Quota de chevaux (atterri en 4.1)** : le plafond (1 en gratuit/premium,
 * illimité en pro — Spec §8) est tranché par `EntitlementsService` (autorité
 * serveur, §5). Le module **fournit le décompte** (`countActifs`, sur ses
 * propres lignes) et **délègue la décision** ; aucune règle de tier n'est
 * dispersée ici (le service ne connaît ni les forfaits ni les chiffres). Les
 * dépendances restent orientées `horses → entitlements` (pas de cycle).
 *
 * **Archivage (lot 4.3, Spec §9.2)** : `archive`/`unarchive` basculent le statut
 * `archivé`. Un cheval archivé est **lecture seule** (`assertModifiable` refuse
 * toute écriture de fiche **et** de séance — ce dernier via `sessions`), **hors
 * liste active du sélecteur** et **hors quota** (`countActifs` filtre
 * `archivé = false` — le décompte pré-câblé en 4.1 s'ajuste ainsi
 * **mécaniquement**). Le **désarchivage est quota-gardé** (même garde 4.1) :
 * ramener un cheval dans l'actif ne peut pas dépasser le plafond du tier.
 * L'**archivage** n'est **pas** gaté par le tier (un cavalier gratuit doit
 * pouvoir archiver son unique cheval, Spec §9.2) ; seul le **désarchivage** l'est.
 */
@Injectable()
export class HorsesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Crée un cheval **lié au compte courant** (le `compte_id` vient du jeton).
   * **Enforce le quota** d'abord : le `tier` (du principal) et le décompte des
   * chevaux **actifs** décident si un cheval de plus est permis (multi-chevaux =
   * pro). Refus → `QuotaDépasséError` (403) avant toute écriture.
   */
  async create(compteId: string, tier: Tier, dto: ChevalCréerDto): Promise<ChevalSortie> {
    this.entitlements.assertPeutCréer(tier, 'chevaux', await this.countActifs(compteId));
    const [row] = await this.db
      .insert(cheval)
      .values({
        compte_id: compteId,
        nom: dto.nom,
        niveau: dto.niveau,
        hauteur_de_référence: dto.hauteur_de_référence,
        âge: dto.âge ?? null,
        race: dto.race ?? null,
      })
      .returning();
    return chevalSortieSchema.parse(row);
  }

  /**
   * Décompte des chevaux **actifs** du compte — base du quota (Spec §8), pour
   * `entitlements`. **Décompte sur l'actif** : un cheval **archivé** (lot 4.3)
   * ne compte plus (`archivé = false` dans le `WHERE`) → il **sort
   * mécaniquement du quota** (Spec §9.2), sans toucher au gating. C'est le seul
   * endroit pré-câblé en 4.1 pour brancher l'archivage.
   */
  async countActifs(compteId: string): Promise<number> {
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(cheval)
      .where(and(eq(cheval.compte_id, compteId), eq(cheval.archivé, false)));
    return n;
  }

  /** Liste les chevaux **du compte courant** uniquement (ordre de création). */
  async list(compteId: string): Promise<ChevalSortie[]> {
    const rows = await this.db
      .select()
      .from(cheval)
      .where(eq(cheval.compte_id, compteId))
      .orderBy(cheval.created_at);
    return rows.map((row) => chevalSortieSchema.parse(row));
  }

  /** Détail d'un cheval **du compte** ; sinon 404 (pas de fuite d'existence). */
  async findOne(compteId: string, id: string): Promise<ChevalSortie> {
    const row = await this.findOwned(compteId, id);
    return chevalSortieSchema.parse(row);
  }

  /**
   * Édite un cheval **du compte** (PATCH partiel). Un champ absent reste
   * inchangé ; `null` sur `âge`/`race` les efface. La mise à jour est filtrée
   * par `compte_id` (scoping) et renvoie 404 si rien n'a matché.
   *
   * **Lecture seule si archivé** (lot 4.3) : `assertModifiable` refuse l'édition
   * d'un cheval archivé (409) avant toute écriture. Le statut d'archivage lui-même
   * ne passe **pas** par ici — il a ses actions dédiées (`archive`/`unarchive`).
   */
  async update(compteId: string, id: string, dto: ChevalModifierDto): Promise<ChevalSortie> {
    await this.assertModifiable(compteId, id);
    const updates: Partial<typeof cheval.$inferInsert> = {};
    if (dto.nom !== undefined) updates.nom = dto.nom;
    if (dto.niveau !== undefined) updates.niveau = dto.niveau;
    if (dto.hauteur_de_référence !== undefined) {
      updates.hauteur_de_référence = dto.hauteur_de_référence;
    }
    if (dto.âge !== undefined) updates.âge = dto.âge;
    if (dto.race !== undefined) updates.race = dto.race;

    // Garde-fou : un PATCH sans champ exploitable (la frontière Zod le rejette
    // déjà en 400) ne doit pas produire un `SET` vide → on relit la fiche.
    if (Object.keys(updates).length === 0) {
      return this.findOne(compteId, id);
    }

    const [row] = await this.db
      .update(cheval)
      .set(updates)
      .where(and(eq(cheval.id, id), eq(cheval.compte_id, compteId)))
      .returning();
    if (!row) {
      throw new ChevalNotFoundError();
    }
    return chevalSortieSchema.parse(row);
  }

  /**
   * Supprime un cheval **du compte** — **purge dure en cascade** : la FK
   * `ON DELETE CASCADE` posée en 0.3 (`Cheval → Séance → {Obstacle, Tour,
   * Contexte}`) emporte tout l'historique rattaché. Pas de soft delete
   * (cohérent avec 1.3). 404 si le cheval n'est pas celui du compte.
   */
  async remove(compteId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(cheval)
      .where(and(eq(cheval.id, id), eq(cheval.compte_id, compteId)))
      .returning({ id: cheval.id });
    if (!row) {
      throw new ChevalNotFoundError();
    }
  }

  /**
   * **Archive** un cheval **du compte** (lot 4.3, Spec §9.2) : passe `archivé =
   * true`. Le cheval **sort du quota** (`countActifs` l'exclut) et de la **liste
   * active** ; son historique est **conservé** (aucune purge) et devient
   * **lecture seule** (`assertModifiable`). **Non gaté par le tier** — un cavalier
   * gratuit doit pouvoir archiver son unique cheval (Spec §9.2). Idempotent
   * (archiver un cheval déjà archivé le laisse archivé). 404 si étranger au compte.
   */
  async archive(compteId: string, id: string): Promise<ChevalSortie> {
    const [row] = await this.db
      .update(cheval)
      .set({ archivé: true })
      .where(and(eq(cheval.id, id), eq(cheval.compte_id, compteId)))
      .returning();
    if (!row) {
      throw new ChevalNotFoundError();
    }
    return chevalSortieSchema.parse(row);
  }

  /**
   * **Désarchive** un cheval **du compte** (lot 4.3, Spec §9.2) — réintègre le
   * cheval à la liste active. **Quota-gardé (garde 4.1)** : réintégrer un cheval
   * revient à **créer une place**, donc soumis à la **même garde que la création**
   * (`assertPeutCréer`). Si le tier est déjà à son plafond de chevaux **actifs**,
   * `QuotaDépasséError` (403) — un gratuit/premium ne contourne donc **pas** la
   * limite 1 cheval en jouant archive/désarchive. `countActifs` exclut ce cheval
   * (encore archivé) : le plafond porte bien sur l'état **après** désarchivage.
   * Idempotent si déjà actif (no-op, aucune vérification — il était déjà compté).
   * 404 si étranger au compte.
   */
  async unarchive(compteId: string, tier: Tier, id: string): Promise<ChevalSortie> {
    const row = await this.findOwned(compteId, id);
    if (!row.archivé) {
      return chevalSortieSchema.parse(row);
    }
    this.entitlements.assertPeutCréer(tier, 'chevaux', await this.countActifs(compteId));
    const [updated] = await this.db
      .update(cheval)
      .set({ archivé: false })
      .where(and(eq(cheval.id, id), eq(cheval.compte_id, compteId)))
      .returning();
    if (!updated) {
      throw new ChevalNotFoundError();
    }
    return chevalSortieSchema.parse(updated);
  }

  /**
   * **Garde d'écriture** partagée (lot 4.3) : charge la fiche **scopée au compte**
   * (404 sans fuite si étrangère) et **refuse si le cheval est archivé** (409,
   * `ChevalArchivéError`). Un cheval archivé est en **lecture seule** (Spec §9.2,
   * cohérent avec l'inviolabilité Modèle §2). Utilisée par `update` (édition de
   * fiche) **et** par le service `sessions` (écriture/édition/suppression de
   * séance) — l'état d'archivage reste **connu du seul module `horses`**.
   */
  async assertModifiable(compteId: string, id: string): Promise<void> {
    const row = await this.findOwned(compteId, id);
    if (row.archivé) {
      throw new ChevalArchivéError();
    }
  }

  /** Charge une ligne **scopée au compte**, ou lève 404. Base du scoping lecture. */
  private async findOwned(compteId: string, id: string): Promise<typeof cheval.$inferSelect> {
    const [row] = await this.db
      .select()
      .from(cheval)
      .where(and(eq(cheval.id, id), eq(cheval.compte_id, compteId)))
      .limit(1);
    if (!row) {
      throw new ChevalNotFoundError();
    }
    return row;
  }
}
