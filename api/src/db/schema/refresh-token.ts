import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { compte } from './compte';

/**
 * Refresh token persisté côté serveur (lot 1.1) — **écart assumé vs le Modèle
 * de données** (entités socle 0.3) : la rotation des refresh tokens impose une
 * persistance serveur (révocation, détection de réutilisation), absente du
 * modèle métier. Ajout par **migration Drizzle additive**. Voir le journal 1.1.
 *
 * Principes :
 * - Le token n'est **jamais** stocké en clair : `token_hash` = SHA-256 (hex) du
 *   JWT de refresh. Le secret du JWT est de haute entropie (signature) → un
 *   hash cryptographique rapide suffit ; argon2 est réservé au mot de passe
 *   (faible entropie).
 * - `id` **est** le `jti` du JWT de refresh : on retrouve la ligne par l'id
 *   décodé du token, puis on compare le hash (défense en profondeur).
 * - **Rotation + détection de réutilisation par famille** (`family_id`) : à
 *   chaque rotation, la ligne courante est révoquée (`revoked_at`) et marquée
 *   `rotated_at` + `replaced_by`. Présenter un token déjà *tourné* (rotated)
 *   = réutilisation → on révoque **toute la famille**.
 * - FK `compte` en **`ON DELETE CASCADE`** : support structurel de la purge
 *   RGPD (lot 1.3), cohérent avec la cascade descendante du socle (0.3).
 */
export const refreshToken = pgTable(
  'refresh_token',
  {
    ...champsTechniques,
    compte_id: uuid('compte_id')
      .notNull()
      .references(() => compte.id, { onDelete: 'cascade' }),
    /** Lignée d'un même login : tournée ensemble lors d'une réutilisation. */
    family_id: uuid('family_id').notNull(),
    /** SHA-256 (hex) du JWT de refresh — jamais le token en clair. */
    token_hash: text('token_hash').notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    /** Posé dès que le token n'est plus utilisable (rotation, logout, purge famille). */
    revoked_at: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    /** Posé spécifiquement quand le token a servi à émettre un successeur. */
    rotated_at: timestamp('rotated_at', { withTimezone: true, mode: 'date' }),
    /** `jti` du successeur (chaîne de rotation) ; null tant que non tourné. */
    replaced_by: uuid('replaced_by'),
  },
  (table) => [
    index('refresh_token_compte_id_idx').on(table.compte_id),
    index('refresh_token_family_id_idx').on(table.family_id),
  ],
);
