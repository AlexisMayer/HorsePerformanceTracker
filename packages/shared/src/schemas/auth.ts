import { z } from 'zod';
import { compteCréerSchema, motDePasseSchema } from './compte';

/**
 * Contrats d'authentification (lot 1.1) — DTO d'entrée/sortie + Zod, source de
 * vérité unique partagée app/api (Architecture §2/§5). Aucun type dupliqué ;
 * aucun champ sensible en sortie (`password_hash` n'apparaît dans AUCUN DTO).
 */

// ───────────────────────────── Entrée ─────────────────────────────

/**
 * Inscription. Réutilise les contraintes de création de compte (0.2) **sans
 * `tier`** : le tier est posé à `gratuit` côté serveur, sans garde
 * d'entitlement (gating = lot 4.1). `email_verified` est géré par le serveur
 * (posé à `false`), jamais fourni par le client.
 */
export const registerSchema = compteCréerSchema.omit({ tier: true });

export type RegisterDto = z.infer<typeof registerSchema>;

/**
 * Connexion. Le mot de passe est seulement **requis** : la politique de
 * longueur s'applique à l'inscription, pas à la vérification (on ne veut ni
 * divulguer la règle, ni rejeter à tort un identifiant à comparer au hash).
 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;

/** Rotation : on présente le refresh courant pour obtenir un nouveau couple. */
export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export type RefreshDto = z.infer<typeof refreshSchema>;

/** Déconnexion : révoque le refresh présenté. */
export const logoutSchema = z.object({
  refresh_token: z.string().min(1),
});

export type LogoutDto = z.infer<typeof logoutSchema>;

// ───────────────── Vérification e-mail & reset (lot 1.2) ─────────────────

/**
 * Demande (re)envoi du lien de **vérification d'e-mail**. Anti-énumération : le
 * serveur répond **200** que le compte existe ou non — ce DTO ne sert qu'à
 * valider la forme de l'e-mail, jamais à confirmer une existence.
 */
export const emailVerificationRequestSchema = z.object({
  email: z.string().email(),
});

export type EmailVerificationRequestDto = z.infer<typeof emailVerificationRequestSchema>;

/**
 * Confirmation de **vérification d'e-mail** : le jeton (à usage unique,
 * expirable) reçu dans le lien. Validé puis consommé côté serveur ;
 * `email_verified` passe à `true`.
 */
export const emailVerificationConfirmSchema = z.object({
  token: z.string().min(1),
});

export type EmailVerificationConfirmDto = z.infer<typeof emailVerificationConfirmSchema>;

/**
 * Demande de **réinitialisation de mot de passe**. Anti-énumération : réponse
 * **200** systématique (le lien n'est envoyé que si le compte existe).
 */
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export type PasswordResetRequestDto = z.infer<typeof passwordResetRequestSchema>;

/**
 * Confirmation de **réinitialisation** : jeton (usage unique, expirable) +
 * nouveau mot de passe. Le serveur re-hache en argon2 et **révoque tous les
 * refresh tokens** du compte (sécurité). `new_password` suit la même politique
 * que l'inscription (`motDePasseSchema`).
 */
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  new_password: motDePasseSchema,
});

export type PasswordResetConfirmDto = z.infer<typeof passwordResetConfirmSchema>;

// ───────────────────────────── Sortie ─────────────────────────────

/**
 * Couple de jetons renvoyé par `login` et `refresh`.
 *
 * Ce ne sont PAS des secrets serveur : ce sont les identifiants destinés au
 * client (le refresh est stocké en secure storage côté appareil — Stack §3.4 —
 * et seulement **hashé** côté serveur). Le `password_hash` n'apparaît jamais.
 * Le `.strip()` retire toute clé inconnue projetée par mégarde.
 */
export const authTokensSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.literal('Bearer'),
    /** Durée de vie de l'access token, en secondes. */
    expires_in: z.number().int().positive(),
  })
  .strip();

export type AuthTokens = z.infer<typeof authTokensSchema>;
