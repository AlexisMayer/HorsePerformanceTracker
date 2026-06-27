import * as argon2 from 'argon2';

/**
 * Constantes d'auth (lot 1.1) — décisions tranchées, consignées au journal.
 *
 * Durées (Setup roadmap, ajustables) : access ~15 min, refresh ~30 j.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Durées de vie des liens à usage unique (lot 1.2, ajustables) :
 * - **vérification d'e-mail** : 24 h (pas urgent, l'utilisateur peut tarder) ;
 * - **réinitialisation de mot de passe** : 1 h (fenêtre courte par sécurité).
 */
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export interface VerificationLinkConfig {
  /** Base des liens d'action (deep link app / page web en prod). */
  baseUrl: string;
  /** Chemin du lien de vérification d'e-mail. */
  emailVerificationPath: string;
  /** Chemin du lien de réinitialisation de mot de passe. */
  passwordResetPath: string;
}

/**
 * Construction des liens d'e-mail. L'UI réelle (écrans, deep links) est le lot
 * 1.4 ; ici on produit un lien **porteur du jeton**, loggé en dev par le
 * `ConsoleMailer`. `APP_PUBLIC_URL` permet de pointer l'environnement cible
 * sans toucher au code.
 */
export function loadVerificationLinkConfig(): VerificationLinkConfig {
  return {
    baseUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
    emailVerificationPath: '/auth/verify-email',
    passwordResetPath: '/auth/password-reset',
  };
}

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
