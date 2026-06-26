/**
 * Référentiels au niveau Compte (Modèle §0/§3).
 *
 * `tier` = offre commerciale (frontière gratuit/premium/pro) ; `type` = nature
 * du compte (un coach déverrouille plus tard le multi-chevaux et les invités).
 */

export const TIERS = ['gratuit', 'premium', 'pro'] as const;

export type Tier = (typeof TIERS)[number];

export const TYPES_COMPTE = ['amateur', 'coach'] as const;

export type TypeCompte = (typeof TYPES_COMPTE)[number];
