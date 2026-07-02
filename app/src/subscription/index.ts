/**
 * Module `subscription` de l'app (lot 4.2) — **upgrade in-app & Mollie** :
 * paywall (offres), checkout (navigateur), retour & déverrouillage (re-lecture
 * de l'entitlement 4.1 + état *pending* honnête), gestion/résiliation.
 *
 * Le **gating reste l'autorité serveur** : ce module **affiche** et **déclenche**
 * (checkout), mais le tier ne s'élève qu'au **webhook** (cf. journal 4.2). La
 * logique testable sans React (`subscription-api`, `upgrade-flow`) vit dans ses
 * modules et est couverte par Vitest ; les ports natifs (navigateur) sont de
 * fins adaptateurs couverts par `tsc`.
 */
export type { CheckoutNavigateurPort, RésultatNavigateurCheckout } from './checkout-browser-port';
export { createNativeCheckoutNavigateurPort } from './native-checkout-browser-port';
export { createSubscriptionApi, type SubscriptionApi } from './subscription-api';
export {
  lancerUpgrade,
  peutPasserPro,
  type UpgradeDeps,
  type UpgradeRésultat,
} from './upgrade-flow';
export {
  ouvrirGestionMollie,
  useAbonnement,
  useActualiserAbonnement,
  useAnnulerAbonnement,
  useOffres,
  usePasserPro,
  useUpgrade,
} from './use-subscription';
