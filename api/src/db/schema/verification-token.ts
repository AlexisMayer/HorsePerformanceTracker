import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { compte } from './compte';

/**
 * Jeton de vérification (lot 1.2) — **écart assumé vs le Modèle de données**
 * (entités socle 0.3) : la vérification d'e-mail et la réinitialisation de mot
 * de passe imposent une persistance serveur (lien à usage unique, expirable),
 * absente du modèle métier. Ajout par **migration Drizzle additive**. Voir le
 * journal 1.2.
 *
 * Décision tranchée : **une seule table** avec un enum `type`
 * (`email_verification | password_reset`) plutôt que deux tables. Les deux
 * usages partagent exactement la même mécanique (jeton hashé à usage unique,
 * expiration, FK compte) ; une table unique évite la duplication de structure
 * et de code, le `type` discrimine. (Cf. journal — table unique vs deux.)
 *
 * Principes :
 * - Le jeton n'est **jamais** stocké en clair : `token_hash` = SHA-256 (hex) du
 *   secret tiré au sort (haute entropie → un hash rapide suffit, argon2 reste
 *   réservé au mot de passe). `UNIQUE` → on retrouve la ligne par le hash du
 *   jeton présenté.
 * - **Usage unique** : `consumed_at` est posé à la consommation ; un jeton déjà
 *   consommé est rejeté (consommation atomique via UPDATE conditionnel).
 * - **Expirable** : `expires_at` (TTL court pour le reset, plus long pour la
 *   vérification — cf. `auth.config.ts`).
 * - FK `compte` en **`ON DELETE CASCADE`** : support structurel de la purge
 *   RGPD (lot 1.3), cohérent avec la cascade descendante du socle (0.3).
 *
 * Clés ASCII (table technique, pas une entité du domaine → pas d'alignement
 * `shared`, même posture que `refresh_token` en 1.1).
 */
export const VERIFICATION_TOKEN_TYPES = ['email_verification', 'password_reset'] as const;
export type VerificationTokenType = (typeof VERIFICATION_TOKEN_TYPES)[number];

export const verificationTokenTypeEnum = pgEnum(
  'verification_token_type',
  VERIFICATION_TOKEN_TYPES,
);

export const verificationToken = pgTable(
  'verification_token',
  {
    ...champsTechniques,
    compte_id: uuid('compte_id')
      .notNull()
      .references(() => compte.id, { onDelete: 'cascade' }),
    /** Discriminant d'usage : vérification d'e-mail ou réinitialisation. */
    type: verificationTokenTypeEnum('type').notNull(),
    /** SHA-256 (hex) du secret du lien — jamais le jeton en clair. */
    token_hash: text('token_hash').notNull().unique(),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    /** Posé à la consommation (usage unique) ; null tant que le jeton est valide. */
    consumed_at: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [index('verification_token_compte_id_idx').on(table.compte_id)],
);
