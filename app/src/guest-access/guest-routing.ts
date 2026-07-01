/**
 * **Décision de routage de la coquille invité** (lot 4.6, Spec §9.5, UI/UX §6.7)
 * — logique **pure** (aucun import React Native), testable par Vitest, consommée
 * par la garde de navigation (`app/_layout`). Pendant `shouldEnterOnboarding`
 * (3.5) pour l'onglet régulier.
 *
 * L'**invité pur** = un compte **authentifié** qui a **au moins un accès partagé**
 * (`GET /guest-access/me`) **et ne possède aucun cheval** : il **saute la création
 * de cheval** (onboarding invité) et **atterrit** directement sur la coquille
 * invité en lecture seule (Feed · Historique · Analytique, sans (+)/✦/switcher).
 *
 * Précédence : un invité pur a `horsesCount === 0` — donc `shouldEnterOnboarding`
 * (3.5) le viserait aussi. La coquille invité **prime** ; l'appelant l'évalue
 * **d'abord** et **attend** que les deux listes (chevaux + accès) soient résolues
 * pour ne jamais faire clignoter l'onboarding « créer un cheval » à un invité.
 */
export function shouldEnterGuestShell(params: {
  authenticated: boolean;
  horsesLoading: boolean;
  horsesCount: number;
  guestLoading: boolean;
  sharedHorsesCount: number;
  inGuest: boolean;
}): boolean {
  const { authenticated, horsesLoading, horsesCount, guestLoading, sharedHorsesCount, inGuest } =
    params;
  return (
    authenticated &&
    !horsesLoading &&
    !guestLoading &&
    horsesCount === 0 &&
    sharedHorsesCount >= 1 &&
    !inGuest
  );
}

/**
 * **Doit-on différer la décision d'onboarding** le temps que l'état invité se
 * résolve ? Vrai tant que les accès partagés **chargent** (pour un compte sans
 * cheval) : sans cette attente, `shouldEnterOnboarding` (3.5) enverrait un invité
 * pur vers « créer un cheval » avant qu'on sache qu'il est invité. Ne bloque que
 * les comptes **sans cheval** (les autres ont déjà leur onglet régulier).
 */
export function guestStateUnresolved(params: {
  authenticated: boolean;
  horsesCount: number;
  guestLoading: boolean;
}): boolean {
  const { authenticated, horsesCount, guestLoading } = params;
  return authenticated && horsesCount === 0 && guestLoading;
}
