import { z } from 'zod';
import { compteCréerSchema } from './compte';

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
