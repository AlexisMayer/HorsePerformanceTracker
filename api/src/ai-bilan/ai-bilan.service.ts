import {
  type BilanAugmentéSortie,
  type BilansAugmentésDisponibles,
  bilanAugmentéSortieSchema,
  bilansAugmentésDisponiblesSchema,
  DISCLAIMER_IA,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { bilanAugmente } from '../db/schema';
import { SessionsService } from '../sessions/sessions.service';
import { BilanAugmentéNotFoundError, BilanAugmentéRateLimitError } from './ai-bilan.errors';
import { AiBilanRateLimiter } from './ai-bilan-rate-limiter';
import { construireContexteBilan } from './build-context';
import { MISTRAL, type MistralPort } from './mistral.port';

/** Code SQLSTATE d'une violation de contrainte d'unicité (Postgres). */
const UNIQUE_VIOLATION = '23505';

/**
 * Service de domaine **`ai-bilan`** (lot 4.5, Architecture §3 — dépend de
 * `sessions`). Pour **une séance**, il produit / relit un **bilan augmenté** =
 * texte consultatif **généré par IA** (Mistral, UE), **à la demande**,
 * **persisté** et **relu sans régénération** (Spec §7).
 *
 * **Orchestration** (aucun calcul de métrique — la sortie est du texte, Modèle
 * §1) :
 *  - `sessions.findOne` / `listForHorse` — la séance + son historique (jamais ses
 *    tables, §1/§3) ; c'est ce qui **vérifie la propriété** (404 sans fuite) ;
 *  - `MistralPort` — l'IA **derrière une interface injectable** (stub en dev/test,
 *    vrai client en prod) ;
 *  - la table `bilan_augmente` — **sa** table (persistance + relecture).
 *
 * **Get-or-create** (Spec §7.3, garde-fou de coût, Stack §3.6) : si un bilan
 * existe déjà pour la séance, on le **renvoie sans appeler l'IA** — la relecture
 * ne régénère jamais et ne consomme pas le rate limit. La génération d'un
 * **nouveau** bilan consomme le rate limit par utilisateur.
 *
 * **Gating (§8)** : l'endpoint est gardé par l'entitlement (4.1, capacité
 * `bilan_augmenté`) — **refusé au gratuit** ; l'invité (4.6) n'y a pas accès.
 */
@Injectable()
export class AiBilanService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sessions: SessionsService,
    private readonly rateLimiter: AiBilanRateLimiter,
    @Inject(MISTRAL) private readonly mistral: MistralPort,
  ) {}

  /**
   * **Génère à la demande** (get-or-create) le bilan augmenté d'une séance **du
   * compte courant** (404 si étrangère). Si un bilan existe déjà, il est
   * **renvoyé tel quel** — **aucun** appel IA, **aucune** consommation de rate
   * limit (relu sans régénération, Spec §7.3). Sinon : rate limit consommé →
   * contexte des dernières séances → appel Mistral → **persistance** → sortie.
   */
  async générer(compteId: string, seanceId: string): Promise<BilanAugmentéSortie> {
    // Propriété de la séance (404 sans fuite) + accès au cheval pour l'historique.
    const séance = await this.sessions.findOne(compteId, seanceId);

    // Get-or-create : un bilan déjà présent est relu SANS régénération ni coût.
    const existant = await this.findBySeance(seanceId);
    if (existant) return this.projeter(existant);

    // Nouvelle génération : rate limiting par utilisateur (garde-fou de coût).
    if (!this.rateLimiter.consume(compteId)) throw new BilanAugmentéRateLimitError();

    // Contexte narratif = dernières séances du cheval (objective + qualitatif).
    const séances = await this.sessions.listForHorse(compteId, séance.cheval_id);
    const contexte = construireContexteBilan(séances, séance);
    const généré = await this.mistral.générerBilan(contexte);

    try {
      const [row] = await this.db
        .insert(bilanAugmente)
        .values({
          seance_id: seanceId,
          date_génération: new Date(),
          modèle: généré.modèle,
          version: généré.version,
          analyse: généré.analyse,
          recommandations: généré.recommandations,
        })
        .returning();
      return this.projeter(row);
    } catch (error) {
      // Course concurrente sur la même séance (UNIQUE) : on relit le gagnant —
      // toujours un seul bilan par séance, jamais de doublon ni de double coût.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        const gagnant = await this.findBySeance(seanceId);
        if (gagnant) return this.projeter(gagnant);
      }
      throw error;
    }
  }

  /**
   * **Relit** le bilan augmenté persisté d'une séance **du compte courant**
   * (404 si séance étrangère, 404 si aucun bilan). **Aucun appel IA** : c'est la
   * relecture « recommandations de la dernière fois » (Spec §7.3).
   */
  async relire(compteId: string, seanceId: string): Promise<BilanAugmentéSortie> {
    await this.sessions.findOne(compteId, seanceId); // propriété (404 sans fuite)
    const row = await this.findBySeance(seanceId);
    if (!row) throw new BilanAugmentéNotFoundError();
    return this.projeter(row);
  }

  /**
   * **Disponibilité** des bilans augmentés d'un cheval **du compte courant** : la
   * liste des `seance_ids` qui **possèdent** un bilan — ce que l'Historique lit
   * pour remplir le **slot ✦** (3.4) **uniquement** là où un bilan existe. On lit
   * les séances possédées via `sessions` (404 sans fuite) puis l'intersection
   * avec **notre** table (jamais la table `seance` en direct, §1).
   */
  async disponibles(compteId: string, chevalId: string): Promise<BilansAugmentésDisponibles> {
    const séances = await this.sessions.listForHorse(compteId, chevalId);
    const ids = séances.map((s) => s.id);
    const avecBilan =
      ids.length === 0
        ? []
        : await this.db
            .select({ seance_id: bilanAugmente.seance_id })
            .from(bilanAugmente)
            .where(inArray(bilanAugmente.seance_id, ids));
    return bilansAugmentésDisponiblesSchema.parse({
      cheval_id: chevalId,
      seance_ids: avecBilan.map((r) => r.seance_id),
    } satisfies BilansAugmentésDisponibles);
  }

  /** Charge le bilan augmenté d'une séance (ou `null`) — sa table (§1). */
  private async findBySeance(seanceId: string): Promise<typeof bilanAugmente.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(bilanAugmente)
      .where(eq(bilanAugmente.seance_id, seanceId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Projette la ligne persistée en DTO de sortie : contenu **regroupé** +
   * **disclaimer** réattaché depuis la constante `shared` (jamais persisté,
   * toujours présent). Validé au bord (Architecture §5).
   */
  private projeter(row: typeof bilanAugmente.$inferSelect): BilanAugmentéSortie {
    return bilanAugmentéSortieSchema.parse({
      id: row.id,
      seance_id: row.seance_id,
      date_génération: row.date_génération,
      modèle: row.modèle,
      version: row.version,
      contenu: { analyse: row.analyse, recommandations: row.recommandations },
      disclaimer: DISCLAIMER_IA,
    } satisfies BilanAugmentéSortie);
  }
}
