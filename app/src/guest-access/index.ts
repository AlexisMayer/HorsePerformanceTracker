/**
 * Module `guest-access` de l'app (lot 4.6, Spec §9.5, UI/UX §5/§6.7) — les
 * **comptes invité** :
 *  - côté **coach** : inviter/lister/révoquer les accès d'un cheval (`useGuestInvites`,
 *    surface de gestion sur la fiche cheval, garde Pro serveur) ;
 *  - côté **invité** : lire ses accès partagés (`GuestAccessProvider` / `useGuestAccess`),
 *    **accepter** une invitation (onboarding invité, jeton en attente), et **consulter**
 *    le cheval partagé en **lecture seule** via les surfaces réutilisées (`read-scope`).
 *
 * La logique testable sans React (`read-scope`, `guest-routing`, `pending-invite`,
 * `guest-access-api`) vit dans ses modules et est couverte par Vitest.
 */

export { createGuestAccessApi, type GuestAccessApi } from './guest-access-api';
export {
  type GuestAccessContextValue,
  GuestAccessProvider,
  useGuestAccess,
} from './guest-access-context';
export { guestAcceptErrorMessage, guestInviteErrorMessage } from './guest-error-messages';
export { GuestInvitesSection } from './guest-invites-section';
export { guestStateUnresolved, shouldEnterGuestShell } from './guest-routing';
export {
  clearPendingInvite,
  getPendingInvite,
  setPendingInvite,
  takePendingInvite,
} from './pending-invite';
export { ReadOnlyBanner } from './read-only-banner';
export { basePathForScope, GUEST_READ_BASE, OWNER_READ_BASE, type ReadScope } from './read-scope';
export { type GuestInvitesState, useGuestInvites } from './use-guest-invites';
