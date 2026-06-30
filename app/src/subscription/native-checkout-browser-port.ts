import * as WebBrowser from 'expo-web-browser';
import type { CheckoutNavigateurPort, RésultatNavigateurCheckout } from './checkout-browser-port';

/**
 * Adaptateur **natif** du port de navigateur de checkout (lot 4.2) —
 * l'implémentation concrète derrière `CheckoutNavigateurPort`. Fin et isolé
 * (toute l'orchestration est dans `upgrade-flow.ts`, testée en Node) : ce
 * fichier n'est **jamais** importé par un test, il est couvert par `tsc` (même
 * posture que les adaptateurs natifs de 2.3/3.3).
 *
 * `openAuthSessionAsync` ouvre une **session d'authentification** (navigateur
 * in-app) adaptée à un retour par **deep link** (`retourUrl`) — exactement le
 * besoin d'un retour de checkout PSP. Conforme **UE/DMA, sans IAP** (Stack §6) ;
 * le **repli IAP store** reste **documenté, non construit** (consigne 4.2).
 *
 * Le retour `success` (deep link atteint) ou `dismiss`/`cancel` (navigateur
 * fermé) n'emporte **aucune** décision de tier : le déverrouillage dépend du
 * **webhook**. On se contente de signaler le retour pour re-lire l'entitlement.
 */
export function createNativeCheckoutNavigateurPort(): CheckoutNavigateurPort {
  return {
    async ouvrir(url: string, retourUrl: string): Promise<RésultatNavigateurCheckout> {
      const résultat = await WebBrowser.openAuthSessionAsync(url, retourUrl);
      return résultat.type === 'success' ? 'terminé' : 'fermé';
    },
  };
}
