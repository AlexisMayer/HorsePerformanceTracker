import { ApiError } from '../auth';

/**
 * Messages « du côté de l'écran » (Architecture §5, UI/UX §7) pour les erreurs de
 * `guest-access` (lot 4.6) — ils **disent quoi faire**, sans jargon. Le serveur
 * reste l'autorité ; l'app ne fait que **traduire** le statut.
 */
export function guestInviteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 409:
        return 'Cette personne a déjà un accès (ou une invitation) à ce cheval.';
      case 403:
        return 'Les comptes invité sont réservés au forfait Pro.';
      case 404:
        return 'Cheval introuvable.';
      case 400:
        return 'Adresse e-mail invalide.';
    }
  }
  return 'Une erreur est survenue. Vérifie ta connexion et réessaie.';
}

/** Messages pour l'**acceptation** d'une invitation (côté invité). */
export function guestAcceptErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'Cette invitation est invalide ou a expiré. Demande à ton coach de te réinviter.';
  }
  return 'Impossible de rejoindre ce cheval pour le moment. Vérifie ta connexion et réessaie.';
}
