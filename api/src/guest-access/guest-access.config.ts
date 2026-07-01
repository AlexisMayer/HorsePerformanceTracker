/**
 * Constantes du module `guest-access` (lot 4.6) — décisions tranchées, consignées
 * au journal.
 *
 * Durée de vie du lien d'invitation : **7 jours**. Plus généreuse que la
 * vérification d'e-mail (24 h, 1.2) — l'invité n'est **pas** encore utilisateur :
 * il doit installer l'app, créer/relier son compte, puis accepter ; on lui laisse
 * de la marge. Ajustable (une seule source).
 */
export const GUEST_INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface GuestInviteLinkConfig {
  /** Base des liens d'action (deep link app / page web en prod). */
  baseUrl: string;
  /** Chemin du lien d'invitation invité (porteur du jeton d'acceptation). */
  invitePath: string;
}

/**
 * Construction du lien d'invitation — **porteur du jeton** d'acceptation, loggé
 * en dev par le `ConsoleMailer` (TEM en prod, Stack §3.5). `APP_PUBLIC_URL`
 * pointe l'environnement cible sans toucher au code (même posture que les liens
 * de vérification/reset, 1.2).
 */
export function loadGuestInviteLinkConfig(): GuestInviteLinkConfig {
  return {
    baseUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
    invitePath: '/guest-invite',
  };
}
