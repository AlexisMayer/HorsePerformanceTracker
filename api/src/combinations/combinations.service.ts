import {
  type CombinaisonCréerDto,
  type CombinaisonModifierDto,
  type CombinaisonSortie,
  combinaisonSortieSchema,
  nomAutoCombinaison,
  type TypeObstacleSimple,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { combinaison } from '../db/schema';
import { CombinaisonInvalideError, CombinaisonNotFoundError } from './combinations.errors';

/**
 * Service de domaine **`combinations`** (lot 2.5, Architecture §3) : la
 * **bibliothèque de combinaisons réutilisables**, **scopée au compte** (Modèle
 * §8, Spec §4). Dépend de `auth-account` (identité) ; **ne lit aucune table d'un
 * autre domaine**. Réciproquement, il **expose** `findForAccount` /
 * `recordUsage` à `sessions` (consommation inter-domaine via service, §1).
 *
 * **Modèle d'autorisation** : toute opération porte le `compteId` du jeton et
 * filtre par `compte_id` **dans le SQL** ; viser la réutilisable d'un autre
 * compte renvoie `CombinaisonNotFoundError` (404 sans fuite, cohérent 2.1/2.2).
 *
 * **Aucun plafond/garde de tier ici** : la limite (gratuit limité / premium-pro
 * illimité, Spec §4.4) est l'affaire de la garde d'entitlement (lot 4.1, autorité
 * serveur) — la capacité se construit ici, la garde la composera (même précédent
 * que 1.1/2.1, on ne disperse pas les checks de `tier`).
 */
@Injectable()
export class CombinationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * **Crée** une réutilisable **liée au compte courant** (depuis un détail de
   * séance ou directement). Le `nom` est **auto-généré** s'il est absent
   * (`nomAutoCombinaison`, Spec §4.3) ; renommage optionnel. La structure
   * (`nombre_d_éléments` + `éléments`) est figée à la création.
   */
  async create(compteId: string, dto: CombinaisonCréerDto): Promise<CombinaisonSortie> {
    const nom = nomChoisi(dto.nom, dto.nombre_d_éléments, dto.éléments);
    const [row] = await this.db
      .insert(combinaison)
      .values({
        compte_id: compteId,
        nom,
        nombre_d_éléments: dto.nombre_d_éléments,
        éléments: dto.éléments,
      })
      .returning();
    return combinaisonSortieSchema.parse(row);
  }

  /**
   * Liste la bibliothèque **du compte courant**, **triée par usage** (anti-bloat,
   * Spec §4.3) : `usage_count` décroissant (« plus utilisées ») d'abord, puis
   * `last_used_at` (« récentes », NULL en dernier), puis `created_at`. Une
   * réutilisable jamais instanciée tombe naturellement en bas, la plus récemment
   * créée en tête de ce bloc.
   */
  async list(compteId: string): Promise<CombinaisonSortie[]> {
    const rows = await this.db
      .select()
      .from(combinaison)
      .where(eq(combinaison.compte_id, compteId))
      .orderBy(
        desc(combinaison.usage_count),
        sql`${combinaison.last_used_at} desc nulls last`,
        desc(combinaison.created_at),
      );
    return rows.map((row) => combinaisonSortieSchema.parse(row));
  }

  /**
   * **« Édite » une réutilisable = en crée une NOUVELLE** (Modèle §8, Spec §4.3 :
   * pas de versioning). L'ancienne reste **intacte** (même `id`, mêmes obstacles
   * liés, même `usage_count`) → identité stable, benchmark fiable (5.2). Le corps
   * (partiel) est **fusionné** avec l'ancienne : un champ absent hérite de
   * l'ancienne. La nouvelle ligne **repart d'un usage à zéro** (identité neuve).
   *
   * Changer `nombre_d_éléments` **sans** fournir une liste `éléments` du même
   * cardinal est rejeté (`CombinaisonInvalideError`, 400) : la liste ordonnée
   * **est** la structure, on ne devine pas les types manquants.
   */
  async update(
    compteId: string,
    id: string,
    dto: CombinaisonModifierDto,
  ): Promise<CombinaisonSortie> {
    const ancienne = await this.findOwned(compteId, id);
    const éléments = (dto.éléments ?? (ancienne.éléments as TypeObstacleSimple[])).slice();
    const nombre_d_éléments =
      dto.nombre_d_éléments ?? (dto.éléments ? dto.éléments.length : ancienne.nombre_d_éléments);
    if (nombre_d_éléments !== éléments.length) {
      throw new CombinaisonInvalideError();
    }
    const nom = nomChoisi(dto.nom ?? ancienne.nom, nombre_d_éléments, éléments);

    const [row] = await this.db
      .insert(combinaison)
      .values({ compte_id: compteId, nom, nombre_d_éléments, éléments })
      .returning();
    return combinaisonSortieSchema.parse(row);
  }

  /**
   * **Supprime** une réutilisable **du compte courant**. Les obstacles qui
   * l'instanciaient passent en **`SET NULL`** (FK 0.3→2.5) : ils **conservent**
   * leurs valeurs (`nombre_d_éléments` copié inline, hauteur, fautes) et donc leur
   * **taux** (§7) ; ils perdent seulement le lien nommé et l'héritage des
   * `éléments`. 404 si la réutilisable n'est pas celle du compte.
   */
  async remove(compteId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(combinaison)
      .where(and(eq(combinaison.id, id), eq(combinaison.compte_id, compteId)))
      .returning({ id: combinaison.id });
    if (!row) {
      throw new CombinaisonNotFoundError();
    }
  }

  // --- Surface consommée par `sessions` (inter-domaine via service, §1) -------

  /**
   * **Valide la propriété** d'une `combinaison_ref` et la **renvoie** — point de
   * couture exposé à `sessions` pour l'instanciation (Architecture §1 : `sessions`
   * passe par ce service, jamais par la table `combinaison`). Lève
   * `CombinaisonNotFoundError` (→ 404) si la ref est étrangère au compte ; sinon
   * `sessions` y lit `nombre_d_éléments` à **copier inline** sur l'obstacle.
   */
  async findForAccount(compteId: string, id: string): Promise<CombinaisonSortie> {
    return combinaisonSortieSchema.parse(await this.findOwned(compteId, id));
  }

  /**
   * **Enregistre des instanciations** (tri anti-bloat) : pour chaque occurrence
   * d'un id dans `ids`, incrémente `usage_count` et pose `last_used_at = now`,
   * **scopé au compte**. Appelé par `sessions` après une **création** réussie
   * (pas à l'édition : éditer une séance n'est pas une nouvelle réutilisation).
   * Idempotent vis-à-vis des ids inconnus (le `WHERE compte_id` les ignore).
   */
  async recordUsage(compteId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    const now = new Date();
    await Promise.all(
      [...counts].map(([id, n]) =>
        this.db
          .update(combinaison)
          .set({ usage_count: sql`${combinaison.usage_count} + ${n}`, last_used_at: now })
          .where(and(eq(combinaison.id, id), eq(combinaison.compte_id, compteId))),
      ),
    );
  }

  /** Charge une réutilisable **scopée au compte**, ou lève 404. Base du scoping. */
  private async findOwned(compteId: string, id: string): Promise<typeof combinaison.$inferSelect> {
    const [row] = await this.db
      .select()
      .from(combinaison)
      .where(and(eq(combinaison.id, id), eq(combinaison.compte_id, compteId)))
      .limit(1);
    if (!row) {
      throw new CombinaisonNotFoundError();
    }
    return row;
  }
}

/** Nom retenu : celui fourni (trimé) s'il est non vide, sinon l'auto-nommage. */
function nomChoisi(
  fourni: string | undefined,
  nombre_d_éléments: number,
  éléments: readonly TypeObstacleSimple[],
): string {
  const trimé = fourni?.trim();
  return trimé && trimé.length > 0 ? trimé : nomAutoCombinaison(nombre_d_éléments, éléments);
}
