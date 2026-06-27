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
    if (error.status >= 500) {
      return 'Le service est momentanément indisponible. Réessaie dans un instant.';
    }
  }
  if (error instanceof TypeError) {
    return 'Connexion impossible. Vérifie ta connexion et réessaie.';
  }
  return 'Une erreur est survenue. Réessaie.';
}
