import { ApiError } from '../auth';

/**
 * Traduit une erreur de l'API `horses` en message **destiné à l'utilisateur**
 * (UI/UX §7, Architecture §5) : dit quoi faire, sans jargon système. Les erreurs
 * de domaine du serveur sont sobres ; on les humanise ici.
 */
export function horseErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'Ce cheval n’existe plus.';
    }
    if (error.status === 400) {
      return 'Vérifie les informations saisies.';
    }
    // Désarchivage bloqué par le quota (lot 4.3 → garde 4.1) : le plafond de
    // chevaux actifs du tier est atteint. On invite au passage Pro (§7).
    if (error.status === 403) {
      return 'Ton forfait ne permet qu’un cheval actif. Passe au Pro pour en suivre plusieurs.';
    }
    // Cheval archivé = lecture seule (lot 4.3) : l'écriture est refusée (409).
    if (error.status === 409) {
      return 'Ce cheval est archivé (lecture seule). Désarchive-le pour le modifier.';
    }
    if (error.status >= 500) {
      return 'Le service est momentanément indisponible. Réessaie dans un instant.';
    }
  }
  if (error instanceof TypeError) {
    return 'Connexion impossible. Vérifie ta connexion et réessaie.';
  }
  return 'Une erreur est survenue. Réessaie.';
}

/**
 * Vrai si l'erreur est un **refus de quota** (403) — un désarchivage bloqué parce
 * que le plafond de chevaux actifs du tier est atteint (garde 4.1). L'UI s'en sert
 * pour proposer l'**upgrade** (verrouillage = invitation, UI/UX §7) plutôt qu'un
 * simple message d'erreur.
 */
export function isQuotaBlocked(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
