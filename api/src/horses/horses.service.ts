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
import { ChevalNotFoundError } from './horses.errors';

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
   * `entitlements`. **Décompte sur l'actif (pré-câblé pour 4.3)** : aujourd'hui
   * il n'y a pas de colonne `archivé`, donc « actif » = tous les chevaux ; quand
   * 4.3 ajoutera l'archivage, il suffira d'ajouter `WHERE archivé = false` ici et
   * un cheval archivé **sortira mécaniquement du quota** (Spec §9.2).
   */
  async countActifs(compteId: string): Promise<number> {
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(cheval)
      .where(eq(cheval.compte_id, compteId));
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
   */
  async update(compteId: string, id: string, dto: ChevalModifierDto): Promise<ChevalSortie> {
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
