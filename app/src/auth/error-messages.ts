import { ApiError } from './api-client';

/**
 * Traduit une erreur d'API en message **destiné à l'utilisateur**, écrit de son
 * côté de l'écran (UI/UX §7, Architecture §5) : il dit quoi faire, sans jargon
 * système. Les erreurs de domaine de 1.1 sont volontairement sobres (pas
 * d'oracle) — on les humanise ici selon le contexte.
 */
export function authErrorMessage(
  error: unknown,
  context: 'login' | 'register' | 'generic',
): string {
  if (error instanceof ApiError) {
    if (error.status === 401 && context === 'login') {
      return 'E-mail ou mot de passe incorrect.';
    }
    if (error.status === 409 && context === 'register') {
      return 'Un compte existe déjà avec cet e-mail.';
    }
    if (error.status === 400) {
      return 'Vérifie les informations saisies.';
    }
    if (error.status >= 500) {
      return 'Le service est momentanément indisponible. Réessaie dans un instant.';
    }
  }
  if (error instanceof TypeError) {
    // Échec réseau (fetch rejette par TypeError).
    return 'Connexion impossible. Vérifie ta connexion et réessaie.';
  }
  return 'Une erreur est survenue. Réessaie.';
}
