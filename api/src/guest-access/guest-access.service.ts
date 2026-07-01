import { randomBytes } from 'node:crypto';
import {
  type AccèsInvitéInviterDto,
  type AccèsInvitéSortie,
  accèsInvitéSortieSchema,
  type ChevalPartagé,
  chevalPartagéSchema,
  type FeedQuery,
  type Fil,
  type HeatmapDto,
  type HistoriqueQuery,
  type Métriques,
  type PageHistorique,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { AnalyticsService } from '../analytics/analytics.service';
import { MAILER, type Mailer } from '../auth-account/mailer/mailer';
import { sha256Hex } from '../auth-account/sha256';
import { type Database, DRIZZLE } from '../db/database.module';
import { accesInvite } from '../db/schema';
import { FeedService } from '../feed/feed.service';
import { HorsesService } from '../horses/horses.service';
import { MetricsService } from '../metrics/metrics.service';
import { SessionsService } from '../sessions/sessions.service';
import { type GuestInviteLinkConfig, loadGuestInviteLinkConfig } from './guest-access.config';
import {
  AccèsInvitéDéjàExistantError,
  AccèsInvitéNotFoundError,
  InvitationInvalideError,
} from './guest-access.errors';

/** Ligne persistée d'un accès invité. */
type AccèsInvitéRow = typeof accesInvite.$inferSelect;

/**
 * Service de domaine **`guest-access`** (lot 4.6, Architecture §3, Spec §9.5) —
 * les **comptes invité** : un coach **pro** accorde à son client un **accès en
 * lecture seule scopé à UN cheval** (« fenêtre vivante » qui remplace l'envoi de
 * rapports), **révocable**, **pas un partage de propriété** (Spec §9.2 — le cheval
 * reste détenu et saisi par le coach).
 *
 * Deux responsabilités, sans jamais recalculer ni refaire les surfaces existantes :
 *
 *  1. **Invitations & octroi** (état sur la table `acces_invite`, seule table du
 *     module) : le coach invite (par e-mail, **plusieurs** par cheval), le client
 *     **accepte** (jeton reçu par e-mail → compte relié, statut `actif`), le coach
 *     **révoque** (statut `révoqué` → lecture coupée). L'invité = **un compte
 *     régulier (1.1) + un octroi scopé** (Stack §3.4) — pas d'auth parallèle.
 *
 *  2. **Autorisation lecture seule scopée** : chaque lecture invité (feed 3.1,
 *     héros 3.2, historique 3.4, analytique 5.1) **vérifie la portée cheval**
 *     (`assertAccèsActif`) puis **réutilise** le service du domaine concerné en le
 *     scopant au **propriétaire** (`compte_pro_id` de l'octroi). Aucune surface
 *     n'est reconstruite (Architecture §2/§3) ; l'invité ne peut **rien** écrire
 *     (aucun endpoint d'écriture) ni voir **un autre** cheval (scope strict).
 *
 * La **garde pro (4.1)** est portée par le **contrôleur de gestion** (capacité
 * `comptes_invité`) ; l'invité, lui, n'est **pas** gaté par un tier (c'est un
 * compte régulier), sa portée vient de l'**octroi**.
 */
@Injectable()
export class GuestAccessService {
  private readonly links: GuestInviteLinkConfig = loadGuestInviteLinkConfig();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly horses: HorsesService,
    private readonly feed: FeedService,
    private readonly metrics: MetricsService,
    private readonly sessions: SessionsService,
    private readonly analytics: AnalyticsService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  // ── Gestion (coach pro) ────────────────────────────────────────────────────

  /**
   * **Invite** un client (par e-mail) sur un cheval **du coach**. Vérifie d'abord
   * la **propriété** du cheval (`horses.findOne` → 404 sans fuite si étranger),
   * refuse un **doublon** non révoqué (même e-mail, même cheval → 409), crée
   * l'octroi `en_attente`, **émet le jeton** d'acceptation (SHA-256 en base,
   * jamais en clair) et **envoie l'invitation** (stub log en dev, TEM en prod).
   * Renvoie la projection de gestion (sans secret).
   */
  async invite(
    coachId: string,
    chevalId: string,
    dto: AccèsInvitéInviterDto,
  ): Promise<AccèsInvitéSortie> {
    // Propriété du cheval (chemin permissif : on peut inviter même sur un cheval
    // archivé — l'invité ne lira qu'un cheval figé, cf. journal 4.3/4.6).
    await this.horses.findOne(coachId, chevalId);

    const email = dto.email.toLowerCase();
    await this.assertPasDeDoublon(chevalId, email);

    const secret = randomBytes(32).toString('base64url');
    const [row] = await this.db
      .insert(accesInvite)
      .values({
        cheval_id: chevalId,
        compte_pro_id: coachId,
        invité_email: email,
        statut: 'en_attente',
        token_hash: sha256Hex(secret),
      })
      .returning();

    await this.mailer.sendGuestInvitation({
      to: email,
      link: `${this.links.baseUrl}${this.links.invitePath}?token=${secret}`,
    });

    return this.toSortie(row);
  }

  /**
   * Liste les accès (invités) d'un cheval **du coach** (récent → ancien).
   * Vérifie la **propriété** du cheval (404 sans fuite si étranger) puis ne rend
   * que les octrois **scopés au coach** (`compte_pro_id`). Aucun secret ne sort.
   */
  async listForHorse(coachId: string, chevalId: string): Promise<AccèsInvitéSortie[]> {
    await this.horses.findOne(coachId, chevalId);
    const rows = await this.db
      .select()
      .from(accesInvite)
      .where(and(eq(accesInvite.cheval_id, chevalId), eq(accesInvite.compte_pro_id, coachId)))
      .orderBy(desc(accesInvite.created_at));
    return rows.map((row) => this.toSortie(row));
  }

  /**
   * **Révoque** un accès **du coach** (scopé `compte_pro_id` dans le `WHERE` →
   * 404 sans fuite si étranger). Passe `statut = révoqué` **et** efface le jeton
   * (`token_hash = null`) — une invitation encore en attente devient
   * inacceptable, un accès actif cesse d'être lisible (`assertAccèsActif` exige
   * `actif`). Idempotent : re-révoquer un octroi déjà révoqué le laisse révoqué.
   */
  async revoke(coachId: string, accèsId: string): Promise<void> {
    const [row] = await this.db
      .update(accesInvite)
      .set({ statut: 'révoqué', token_hash: null })
      .where(and(eq(accesInvite.id, accèsId), eq(accesInvite.compte_pro_id, coachId)))
      .returning({ id: accesInvite.id });
    if (!row) {
      throw new AccèsInvitéNotFoundError();
    }
  }

  // ── Onboarding & consultation (client invité) ──────────────────────────────

  /**
   * Le client **accepte** une invitation via le **jeton** reçu par e-mail
   * (capacité au porteur, comme la vérification/reset 1.2 — **sans** exiger que
   * l'e-mail du compte corresponde à l'invité : posséder le jeton prouve la
   * réception). L'appelant est **déjà authentifié** (compte régulier 1.1) : on
   * **relie** son compte à l'octroi `en_attente`, passe en `actif` et **consomme**
   * le jeton (`token_hash = null`). Renvoie **où atterrir** (le cheval partagé) —
   * l'onboarding invité **saute la création de cheval** (Spec §9.5).
   */
  async accept(guestId: string, token: string): Promise<ChevalPartagé> {
    const [row] = await this.db
      .update(accesInvite)
      .set({ invité_compte_id: guestId, statut: 'actif', token_hash: null })
      .where(
        and(eq(accesInvite.token_hash, sha256Hex(token)), eq(accesInvite.statut, 'en_attente')),
      )
      .returning();
    if (!row) {
      throw new InvitationInvalideError();
    }
    return this.chevalPartagé(row);
  }

  /**
   * Liste les **chevaux partagés** que l'invité peut consulter (accès `actif`),
   * **dédupliqués** par cheval — l'atterrissage et la coquille invité (UI/UX §6.7)
   * n'ont besoin que de `{ cheval_id, cheval_nom }` (scope strict à UN cheval :
   * ni propriétaire, ni autres chevaux exposés). Vide si l'invité n'a aucun accès
   * actif (invitation non acceptée ou révoquée).
   */
  async listForGuest(guestId: string): Promise<ChevalPartagé[]> {
    const rows = await this.db
      .select()
      .from(accesInvite)
      .where(and(eq(accesInvite.invité_compte_id, guestId), eq(accesInvite.statut, 'actif')))
      .orderBy(desc(accesInvite.created_at));

    // Dédup par cheval (un même cheval peut porter deux octrois au même invité).
    const vus = new Set<string>();
    const distincts: AccèsInvitéRow[] = [];
    for (const row of rows) {
      if (!vus.has(row.cheval_id)) {
        vus.add(row.cheval_id);
        distincts.push(row);
      }
    }
    return Promise.all(distincts.map((row) => this.chevalPartagé(row)));
  }

  /**
   * **Fil (3.1)** du cheval partagé, en **lecture seule scopée** : vérifie l'accès
   * **actif** de l'invité (404 sinon, sans fuite), puis **réutilise**
   * `FeedService` scopé au **propriétaire** (`compte_pro_id`) — le cheval lui
   * appartient, la composition est identique à celle du coach. Aucune reconstruction.
   */
  async feedForGuest(guestId: string, chevalId: string, query: FeedQuery): Promise<Fil> {
    const accès = await this.assertAccèsActif(guestId, chevalId);
    return this.feed.compose(accès.compte_pro_id, chevalId, query);
  }

  /** **Héros/métriques (3.2)** du cheval partagé, lecture seule scopée. */
  async metricsForGuest(guestId: string, chevalId: string): Promise<Métriques> {
    const accès = await this.assertAccèsActif(guestId, chevalId);
    return this.metrics.compose(accès.compte_pro_id, chevalId);
  }

  /** **Historique (3.4)** paginé du cheval partagé, lecture seule scopée. */
  async historyForGuest(
    guestId: string,
    chevalId: string,
    query: HistoriqueQuery,
  ): Promise<PageHistorique> {
    const accès = await this.assertAccèsActif(guestId, chevalId);
    return this.sessions.listHistory(accès.compte_pro_id, chevalId, query);
  }

  /**
   * **Analytique (5.1)** du cheval partagé, lecture seule scopée. L'invité
   * **n'est pas** gaté par `analytique_diagnostic` (c'est un compte régulier) : sa
   * portée vient de l'**octroi** ; la heatmap existe car le **propriétaire** est
   * pro. On **réutilise** `AnalyticsService` (composition, sans la garde
   * d'entitlement du contrôleur analytics).
   */
  async heatmapForGuest(guestId: string, chevalId: string): Promise<HeatmapDto> {
    const accès = await this.assertAccèsActif(guestId, chevalId);
    return this.analytics.heatmap(accès.compte_pro_id, chevalId);
  }

  // ── Interne ────────────────────────────────────────────────────────────────

  /**
   * **Garde de portée** : l'invité a-t-il un accès **actif** sur **ce** cheval ?
   * Scoping appliqué **dans le SQL** (`invité_compte_id = … AND statut = actif`) :
   * un accès **révoqué**, **en attente**, ou visant un **autre** cheval ne matche
   * pas → `AccèsInvitéNotFoundError` (404 sans fuite). Renvoie l'octroi (porteur du
   * `compte_pro_id` propriétaire, qui scope la lecture réutilisée).
   */
  private async assertAccèsActif(guestId: string, chevalId: string): Promise<AccèsInvitéRow> {
    const [row] = await this.db
      .select()
      .from(accesInvite)
      .where(
        and(
          eq(accesInvite.cheval_id, chevalId),
          eq(accesInvite.invité_compte_id, guestId),
          eq(accesInvite.statut, 'actif'),
        ),
      )
      .limit(1);
    if (!row) {
      throw new AccèsInvitéNotFoundError();
    }
    return row;
  }

  /**
   * Refuse un **doublon** : un octroi **non révoqué** (en attente ou actif) sur le
   * même couple (cheval, e-mail) → 409. Ré-inviter après **révocation** est permis
   * (l'octroi révoqué ne matche pas). Plusieurs invités *différents* restent OK.
   */
  private async assertPasDeDoublon(chevalId: string, email: string): Promise<void> {
    const rows = await this.db
      .select({ statut: accesInvite.statut })
      .from(accesInvite)
      .where(and(eq(accesInvite.cheval_id, chevalId), eq(accesInvite.invité_email, email)));
    if (rows.some((r) => r.statut !== 'révoqué')) {
      throw new AccèsInvitéDéjàExistantError();
    }
  }

  /** Projette une ligne vers la **vue coach** (sans secret ; `invité_relié` dérivé). */
  private toSortie(row: AccèsInvitéRow): AccèsInvitéSortie {
    return accèsInvitéSortieSchema.parse({
      id: row.id,
      cheval_id: row.cheval_id,
      invité_email: row.invité_email,
      invité_relié: row.invité_compte_id !== null,
      statut: row.statut,
      created_at: row.created_at,
    } satisfies AccèsInvitéSortie);
  }

  /**
   * Résout le **cheval partagé** (`{ cheval_id, cheval_nom }`) d'un octroi en
   * lisant la fiche **via `horses`** scopée au **propriétaire** (`compte_pro_id`),
   * jamais en lisant la table `cheval` (Architecture §1). Strict minimum pour la
   * coquille invité (scope à UN cheval, Spec §9.5).
   */
  private async chevalPartagé(row: AccèsInvitéRow): Promise<ChevalPartagé> {
    const cheval = await this.horses.findOne(row.compte_pro_id, row.cheval_id);
    return chevalPartagéSchema.parse({
      cheval_id: cheval.id,
      cheval_nom: cheval.nom,
    } satisfies ChevalPartagé);
  }
}
