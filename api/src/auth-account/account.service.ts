import { type AccountExport, accountExportSchema } from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { cheval, compte, contexte, obstacle, seance, tour } from '../db/schema';
import { InvalidCredentialsError } from './auth.errors';
import { PasswordService } from './password.service';

/** Regroupe une liste plate par clé de parent (montage de l'arbre d'export). */
function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}

/**
 * Service de domaine **RGPD du compte** (lot 1.3, module `auth-account` —
 * Architecture §3). Implémente les droits des personnes au niveau compte :
 * **suppression** (droit à l'effacement) et **export** (droit à la portabilité).
 * Aucune dépendance HTTP ; lève des erreurs de domaine typées (Architecture §5).
 */
@Injectable()
export class AccountService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * **Suppression de compte** (droit à l'effacement) — **purge dure** : pas de
   * soft delete en v1 (la spec dit *purge*, §9.1). On **re-vérifie l'identité
   * par mot de passe** (la route est déjà authentifiée ; cette confirmation
   * protège contre un jeton d'accès volé sur une action irréversible).
   *
   * Le `DELETE` sur `compte` déclenche le `ON DELETE CASCADE` de tout l'arbre de
   * propriété (Cheval → Séance → {Obstacle, Tour, Contexte}, Modèle §3) **et**
   * des tables techniques d'auth (refresh tokens du lot 1.1, jetons de
   * vérification du lot 1.2), qui portent toutes une FK `compte_id` en cascade :
   * aucune ligne orpheline ne subsiste (prouvé par `account.spec.ts`).
   */
  async deleteAccount(compteId: string, password: string): Promise<void> {
    const [row] = await this.db
      .select({ password_hash: compte.password_hash })
      .from(compte)
      .where(eq(compte.id, compteId))
      .limit(1);
    // Compte introuvable (déjà supprimé) ou mot de passe erroné → 401 générique,
    // sans distinguer les deux cas (pas d'oracle).
    if (!row || !(await this.passwords.verify(row.password_hash, password))) {
      throw new InvalidCredentialsError();
    }

    await this.db.delete(compte).where(eq(compte.id, compteId));
  }

  /**
   * **Export complet** (droit à la portabilité) — JSON structuré, **synchrone**
   * (échelle v1). Reconstruit l'arbre de propriété du compte et le projette via
   * `accountExportSchema` : le compte est sans secret (`compteSortieSchema`) et
   * les `.object()` Zod retirent toute clé inattendue. **Exclut** les secrets
   * (`password_hash`) et les tables techniques d'auth (refresh tokens, jetons) —
   * ce ne sont pas des données de portabilité. **Inclut** `live` ET
   * `déclaratif` (toutes deux saisies par l'utilisateur).
   *
   * Lecture en **requêtes groupées** (une par niveau, via `inArray`) puis
   * assemblage en mémoire : pas de N+1, sans complexité prématurée.
   */
  async exportAccount(compteId: string): Promise<AccountExport> {
    const [compteRow] = await this.db.select().from(compte).where(eq(compte.id, compteId)).limit(1);
    if (!compteRow) {
      throw new InvalidCredentialsError();
    }

    const chevaux = await this.db.select().from(cheval).where(eq(cheval.compte_id, compteId));
    const chevalIds = chevaux.map((c) => c.id);

    const seances = chevalIds.length
      ? await this.db.select().from(seance).where(inArray(seance.cheval_id, chevalIds))
      : [];
    const seanceIds = seances.map((s) => s.id);

    let obstacles: (typeof obstacle.$inferSelect)[] = [];
    let tours: (typeof tour.$inferSelect)[] = [];
    let contextes: (typeof contexte.$inferSelect)[] = [];
    if (seanceIds.length) {
      [obstacles, tours, contextes] = await Promise.all([
        this.db.select().from(obstacle).where(inArray(obstacle.seance_id, seanceIds)),
        this.db.select().from(tour).where(inArray(tour.seance_id, seanceIds)),
        this.db.select().from(contexte).where(inArray(contexte.seance_id, seanceIds)),
      ]);
    }

    const obstaclesBySeance = groupBy(obstacles, (o) => o.seance_id);
    const toursBySeance = groupBy(tours, (t) => t.seance_id);
    const contexteBySeance = new Map(contextes.map((c) => [c.seance_id, c]));
    const seancesByCheval = groupBy(seances, (s) => s.cheval_id);

    const chevauxTree = chevaux.map((c) => ({
      ...c,
      seances: (seancesByCheval.get(c.id) ?? []).map((s) => ({
        ...s,
        obstacles: obstaclesBySeance.get(s.id) ?? [],
        tours: toursBySeance.get(s.id) ?? [],
        contexte: contexteBySeance.get(s.id) ?? null,
      })),
    }));

    return accountExportSchema.parse({
      exported_at: new Date(),
      compte: compteRow,
      chevaux: chevauxTree,
    });
  }
}
