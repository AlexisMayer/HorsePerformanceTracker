import type { StatutAbonnement, Tier, TierPayant } from '@hpt/shared';
import type { CheckoutNavigateurPort, RésultatNavigateurCheckout } from './checkout-browser-port';
import type { SubscriptionApi } from './subscription-api';

/**
 * **Orchestration de l'upgrade in-app** (lot 4.2) — logique **pure et
 * injectable**, testée en Node (les dépendances I/O passent par des ports).
 * Enchaîne, sans rien décider du tier :
 *
 *  1. `createCheckout(tier)` → URL de checkout Mollie (abonnement `en_attente`,
 *     tier **non** élevé) ;
 *  2. ouverture du **navigateur** de checkout (in-app/externe) jusqu'au retour ;
 *  3. **au retour** — quel que soit le résultat — `rafraîchir()` : force la
 *     **rotation du jeton** (contrat 4.1, pour que le claim `tier` rejoigne le
 *     serveur) puis **re-lit** l'entitlement et l'état d'abonnement.
 *
 * Le **déverrouillage est l'autorité serveur** (webhook) : ce flux ne lit jamais
 * le résultat du navigateur comme une élévation. C'est l'écran appelant qui,
 * **après** `rafraîchir()`, lit l'entitlement (déverrouillé ?) et l'abonnement
 * (`en_attente` ⇒ état *pending* honnête, SEPA non confirmé).
 */
export interface UpgradeDeps {
  api: Pick<SubscriptionApi, 'createCheckout'>;
  navigateur: CheckoutNavigateurPort;
  /** Force refresh du jeton + re-lecture entitlement/abonnement (autorité serveur). */
  rafraîchir: () => Promise<void>;
  /** Deep link de retour dans l'app (doit matcher le `redirectUrl` serveur). */
  retourUrl: string;
}

export interface UpgradeRésultat {
  /** Comment l'utilisateur est revenu du navigateur (jamais une décision de tier). */
  retour: RésultatNavigateurCheckout;
}

/**
 * Lance le flux d'upgrade vers `tierCible`. Résout après le retour du navigateur
 * **et** la re-lecture de l'entitlement (l'écran lit ensuite l'état déverrouillé
 * / *pending*). Propage une erreur uniquement si le checkout ne peut être créé
 * (réseau / serveur) — la fermeture du navigateur n'est pas une erreur.
 */
export async function lancerUpgrade(
  deps: UpgradeDeps,
  tierCible: TierPayant,
): Promise<UpgradeRésultat> {
  const { checkout_url } = await deps.api.createCheckout(tierCible);
  const retour = await deps.navigateur.ouvrir(checkout_url, deps.retourUrl);
  // Re-lecture systématique au retour : le tier a pu être élevé par le webhook
  // pendant le checkout (ou rester en attente si SEPA non confirmé).
  await deps.rafraîchir();
  return { retour };
}

/**
 * **Peut-on proposer « Passer à Pro » ?** (MOD-001) — décision **pure et testable**
 * du CTA de changement de formule au Profil. Le changement de formule est réservé
 * au tier **premium** : un **gratuit** *souscrit* (paywall), un **pro** n'a rien à
 * changer (downgrade hors périmètre). On **masque** le CTA tant qu'un changement est
 * déjà `en_attente` — l'écran affiche alors l'état *pending* honnête **au-dessus de
 * l'accès premium conservé**, sans risque de re-déclencher un second paiement.
 *
 * L'autorité reste **serveur** (garde `changer-formule`) : ce prédicat ne fait que
 * piloter l'affichage, jamais le tier.
 */
export function peutPasserPro(
  tier: Tier | null,
  statutAbonnement: StatutAbonnement | null,
): boolean {
  return tier === 'premium' && statutAbonnement !== 'en_attente';
}
