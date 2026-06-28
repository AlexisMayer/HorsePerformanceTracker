import { ApiError } from '../auth';

/**
 * Traduit une erreur d'enregistrement de séance en message **destiné à
 * l'utilisateur** (UI/UX §7, Architecture §5) : dit quoi faire, sans jargon. On
 * **rassure** explicitement que la saisie est gardée (brouillon local) sur les
 * erreurs réessayables — « ne jamais perdre une saisie » (Stack §4).
 */
export function sessionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Ce cheval n’existe plus.';
    if (error.status === 400) return 'Vérifie les informations de la séance.';
    if (error.status === 401) return 'Ta session a expiré. Reconnecte-toi pour enregistrer.';
    if (error.status >= 500) {
      return 'Le service est momentanément indisponible. Ta saisie est gardée — réessaie.';
    }
  }
  if (error instanceof TypeError) {
    return 'Connexion impossible. Ta saisie est gardée — réessaie dès que le réseau revient.';
  }
  return 'Une erreur est survenue. Ta saisie est gardée — réessaie.';
}
