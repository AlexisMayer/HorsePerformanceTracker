/**
 * **Jeton d'invitation en attente** (lot 4.6) — petit store mémoire, pur et
 * testable, qui **fait survivre** le jeton d'une invitation ouverte par deep link
 * à la traversée de l'auth. Parcours (Spec §9.5, onboarding invité) :
 *
 *  1. l'invité ouvre le lien `…/guest-invite?token=…` (reçu par e-mail) ;
 *  2. s'il n'est **pas** connecté, l'écran **stashe** le jeton ici puis renvoie
 *     vers login/register ;
 *  3. une fois **authentifié**, le `GuestAccessProvider` **consomme** le jeton en
 *     attente → accepte l'invitation → l'invité **atterrit** sur le cheval partagé
 *     (il **saute la création de cheval**).
 *
 * Mémoire de session (le flux vit dans un même lancement d'app) : volontairement
 * **pas** de persistance disque — pas d'abstraction prématurée (Architecture §7).
 */

let pendingToken: string | null = null;

/** Mémorise le jeton d'une invitation à accepter après authentification. */
export function setPendingInvite(token: string): void {
  pendingToken = token;
}

/** Le jeton en attente, ou `null`. */
export function getPendingInvite(): string | null {
  return pendingToken;
}

/** **Consomme** le jeton en attente : le renvoie **et** le vide (usage unique). */
export function takePendingInvite(): string | null {
  const token = pendingToken;
  pendingToken = null;
  return token;
}

/** Vide le jeton en attente (annulation). */
export function clearPendingInvite(): void {
  pendingToken = null;
}
