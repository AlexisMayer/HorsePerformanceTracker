/**
 * **Portée de lecture** des surfaces réutilisées (lot 4.6) — module **pur**
 * (aucun import React), testable par Vitest. Le feed (3.1), les héros (3.2),
 * l'historique (3.4) et l'analytique (5.1) sont **relus tels quels** ; seul leur
 * **préfixe de route** change selon qui lit :
 *
 *  - `owner` (défaut) → routes propriétaire (`/horses/:id/…`) : le compte lit
 *    **ses** chevaux (scope compte, gating premium/pro habituel) ;
 *  - `guest` → routes invité (`/guest-access/horses/:id/…`) : l'invité lit le
 *    **cheval partagé** en **lecture seule scopée** par l'octroi (portée = octroi,
 *    pas le tier de l'invité, lot 4.6).
 *
 * Les hooks/apis de lecture acceptent un **`basePath`** (défaut `OWNER_READ_BASE`)
 * plutôt qu'un couplage direct au module `guest-access` — la coquille invité passe
 * simplement `GUEST_READ_BASE`. Aucune surface n'est reconstruite (Architecture
 * §2/§3) ; le serveur reste l'autorité de la portée.
 */

export type ReadScope = 'owner' | 'guest';

/** Préfixe de route des lectures **propriétaire** (défaut). */
export const OWNER_READ_BASE = '/horses';

/** Préfixe de route des lectures **invité** (scopées par l'octroi, lot 4.6). */
export const GUEST_READ_BASE = '/guest-access/horses';

/** Résout le préfixe de route d'une portée de lecture. */
export function basePathForScope(scope: ReadScope): string {
  return scope === 'guest' ? GUEST_READ_BASE : OWNER_READ_BASE;
}
