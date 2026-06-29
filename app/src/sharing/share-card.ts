import type { CarteBilan } from '@hpt/shared';
import { messagePartage } from './card-format';
import type { CartePartagePort, CibleCapture, PartageRésultat } from './card-share-port';

/**
 * **Orchestration du partage d'une carte** (lot 3.3) — pure (le port natif est
 * injecté), donc testée en Node comme `submitSession` (2.3) : pas de rendu RN, pas
 * de module natif. Déroulé :
 *
 *  1. **capturer** la vue de la carte en image (`port.capturer`) ;
 *  2. **partager** via la feuille de partage native (`port.partager`) avec
 *     l'image si la capture a réussi, **sinon le texte** de repli.
 *
 * La capture peut échouer (vue non montée, module indisponible) : on **n'échoue
 * jamais** la promesse pour autant — on replie sur le partage texte (le partage
 * natif reste fonctionnel partout, l'image est un bonus). Une **annulation**
 * utilisateur n'est pas une erreur (le port la signale en résultat, pas en
 * exception).
 */
export async function partagerCarte(
  port: CartePartagePort,
  cible: CibleCapture,
  carte: CarteBilan,
  nomCheval: string,
): Promise<PartageRésultat> {
  let uri: string | null = null;
  try {
    uri = await port.capturer(cible);
  } catch {
    // Capture indisponible/échouée → repli texte (jamais de crash).
    uri = null;
  }

  return port.partager({
    uri,
    message: messagePartage(carte, nomCheval),
    titre: `Bilan de ${nomCheval}`,
  });
}
