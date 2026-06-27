import {
  type ChevalCréerDto,
  type ChevalModifierDto,
  type ChevalSortie,
  chevalSortieSchema,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { cheval } from '../db/schema';
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
 * **Aucun check de quota/tier ici** : le plafond (1 en gratuit/premium,
 * illimité en pro) est l'affaire de la garde d'entitlement (lot 4.1, autorité
 * serveur) — la capacité se construit ici, la garde la composera plus tard.
 */
@Injectable()
export class HorsesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Crée un cheval **lié au compte courant** (le `compte_id` vient du jeton). */
  async create(compteId: string, dto: ChevalCréerDto): Promise<ChevalSortie> {
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
