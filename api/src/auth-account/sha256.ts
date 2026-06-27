import { createHash } from 'node:crypto';

/**
 * SHA-256 (hex) d'une valeur de **haute entropie** (jeton de refresh signé,
 * secret de lien tiré au sort). Réservé aux secrets à forte entropie : un hash
 * cryptographique rapide y suffit. Les mots de passe (faible entropie) restent
 * en **argon2** (cf. `PasswordService`). Partagé par `TokenService` (1.1) et
 * `VerificationService` (1.2) — une seule implémentation.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
