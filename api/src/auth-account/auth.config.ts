import * as argon2 from 'argon2';

/**
 * Constantes d'auth (lot 1.1) — décisions tranchées, consignées au journal.
 *
 * Durées (Setup roadmap, ajustables) : access ~15 min, refresh ~30 j.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Paramètres argon2 — recommandation OWASP (Password Storage Cheat Sheet) :
 * **argon2id**, mémoire 19 MiB (19456 KiB), `timeCost = 2`, `parallelism = 1`.
 * Bon compromis coût/sécurité pour un serveur applicatif, reproductible en CI.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface AuthSecrets {
  accessSecret: string;
  refreshSecret: string;
}

/**
 * Secrets de signature JWT (access et refresh **distincts**). En prod ils
 * proviennent du Secret Manager via l'environnement (Stack §3.5) ; en dev/test,
 * repli ergonomique — jamais un secret réel commité, même posture que
 * `DATABASE_URL` (lot 0.3).
 */
export function loadAuthSecrets(): AuthSecrets {
  return {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
  };
}
