import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { cheval } from './cheval';
import { compte } from './compte';
import { accesInviteStatutEnum } from './enums';

/**
 * **Accès invité** (Modèle §3, Spec §9.5, lot 4.6) — entité **spécifiée au
 * Modèle de données** mais **non posée en 0.3** (6 entités socle) → **back-doc**,
 * même posture que le Bilan augmenté (4.5). Ajout par **migration Drizzle
 * additive**.
 *
 * Un **accès en lecture seule** accordé par un compte **pro** à son client sur
 * **une** fiche cheval — **pas un partage de propriété** (Spec §9.2/§9.5) : le
 * cheval reste détenu et saisi par le coach. Un cheval porte **0..N** accès
 * (propriétaire + cavalier…), chacun **révocable**.
 *
 * - `cheval_id`        : le **cheval partagé** (FK `cheval`, **`ON DELETE
 *   CASCADE`** — supprimer/purger le cheval emporte ses accès).
 * - `compte_pro_id`    : le **compte pro** propriétaire ayant accordé l'accès
 *   (FK `compte`, `ON DELETE CASCADE`). Enregistré explicitement (« détenu par un
 *   compte pro », Modèle §3) : il **scope les lectures invité** au propriétaire
 *   sans relire la table d'un autre module (Archi §1) ; la propriété d'un cheval
 *   est **immuable** en v1 (Modèle §3) → pas de dérive.
 * - `invité_email`     : e-mail invité (destinataire TEM). Colonne désaccentuée
 *   (`invite_email`) ; clé TS accentuée (alignement `shared`, comme `archivé`).
 * - `invité_compte_id` : compte du client une fois **relié** (à l'acceptation),
 *   **nullable** tant que `en_attente` (FK `compte`, `ON DELETE CASCADE` — purge
 *   RGPD du client). Désaccentué (`invite_compte_id`).
 * - `statut`           : `en_attente | actif | révoqué` (défaut `en_attente`).
 * - `token_hash`       : **SHA-256** (hex) du jeton d'invitation — **jamais** le
 *   jeton en clair (haute entropie → hash rapide, comme `verification_token` 1.2).
 *   `UNIQUE` (on retrouve l'octroi par le hash présenté). **Nullable et posé à
 *   `null` une fois consommé/révoqué** (Postgres autorise plusieurs `NULL` en
 *   colonne `UNIQUE`) — colonne **technique**, exclue de l'alignement `shared`
 *   (même posture qu'`idempotency_key` sur `seance`).
 */
export const accesInvite = pgTable(
  'acces_invite',
  {
    ...champsTechniques,
    cheval_id: uuid('cheval_id')
      .notNull()
      .references(() => cheval.id, { onDelete: 'cascade' }),
    compte_pro_id: uuid('compte_pro_id')
      .notNull()
      .references(() => compte.id, { onDelete: 'cascade' }),
    invité_email: text('invite_email').notNull(),
    invité_compte_id: uuid('invite_compte_id').references(() => compte.id, { onDelete: 'cascade' }),
    statut: accesInviteStatutEnum('statut').notNull().default('en_attente'),
    token_hash: text('token_hash').unique(),
  },
  (table) => [
    // Lectures invité : « accès actifs d'un cheval » / « accès d'un invité ».
    index('acces_invite_cheval_id_idx').on(table.cheval_id),
    index('acces_invite_invite_compte_id_idx').on(table.invité_compte_id),
    // Gestion coach : « invités d'un cheval que je possède ».
    index('acces_invite_compte_pro_id_idx').on(table.compte_pro_id),
  ],
);
