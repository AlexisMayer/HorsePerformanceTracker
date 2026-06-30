/**
 * **Port du navigateur de checkout** (lot 4.2) — la frontière d'I/O native
 * (ouvrir le checkout Mollie en navigateur in-app/externe) isolée derrière une
 * interface étroite et **injectable** (même posture que le port de partage de
 * 3.3). L'**orchestration** (`upgrade-flow.ts`) ne dépend que de ce type —
 * **aucun** import natif ici — donc elle se teste avec un faux port, sans
 * navigateur réel.
 *
 * Le **déverrouillage ne dépend pas** de ce retour (il dépend du **webhook**,
 * autorité serveur) : `terminé`/`fermé` ne sert qu'à savoir que l'utilisateur
 * est revenu, pour **re-lire** l'entitlement. Fermer le navigateur n'est donc
 * jamais une erreur.
 */

/** Issue de l'ouverture du checkout : revenu via le deep link, ou fermé/annulé. */
export type RésultatNavigateurCheckout = 'terminé' | 'fermé';

/** Port injectable : ouvre une URL de checkout et résout au retour dans l'app. */
export interface CheckoutNavigateurPort {
  /**
   * Ouvre `url` (page de paiement Mollie) et résout quand l'app est rejointe via
   * `retourUrl` (deep link) **ou** quand l'utilisateur ferme le navigateur.
   */
  ouvrir(url: string, retourUrl: string): Promise<RésultatNavigateurCheckout>;
}
