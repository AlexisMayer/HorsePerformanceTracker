/**
 * Module `entitlements` de l'app (lot 4.1) — **lecture de l'entitlement au
 * login** (tier + capacités + quotas), câblée sur `GET /me/entitlement`. Surface
 * React : `EntitlementsProvider` + `useEntitlement`. La logique testable sans
 * React (`entitlements-api`) vit dans son module et est couverte par Vitest.
 *
 * Le gating reste l'**autorité serveur** : ce module **affiche** le tier
 * (Profil, UI/UX §5) ; le grisage/paywall (4.2) viendront s'appuyer dessus.
 */
export { createEntitlementsApi, type EntitlementsApi } from './entitlements-api';
export {
  type EntitlementsContextValue,
  EntitlementsProvider,
  useEntitlement,
} from './entitlements-context';
