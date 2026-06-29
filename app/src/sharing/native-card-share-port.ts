import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type {
  CartePartagePort,
  CibleCapture,
  PartagePayload,
  PartageRésultat,
} from './card-share-port';

/**
 * Adaptateur **natif** du port de partage (lot 3.3) — l'implémentation concrète
 * derrière `CartePartagePort`. Fin et isolé (toute la logique d'orchestration est
 * dans `share-card.ts`, testée en Node) : ce fichier n'est **jamais** importé par
 * un test, il est couvert par `tsc` (même posture que le store de brouillon natif
 * de 2.3). Deux primitives :
 *
 *  - **capture** : `react-native-view-shot` rastérise la vue de la carte en **PNG**
 *    (fichier temporaire) — le « rendu image » de la carte (UI/UX §6.6) ;
 *  - **partage** : `expo-sharing` ouvre la **feuille de partage native** pour le
 *    fichier image (cross-plateforme) ; à défaut (capture indisponible), repli sur
 *    `Share` (RN core) en **texte** — le partage natif reste fonctionnel partout.
 *
 * Aucune capture/partage n'est jamais imposé : c'est l'utilisateur qui déclenche
 * (`[ Partager ]`), et fermer la feuille (`dismissedAction`) n'est pas une erreur.
 */
export function createNativeCartePartagePort(): CartePartagePort {
  return {
    async capturer(cible: CibleCapture): Promise<string | null> {
      if (cible == null) return null;
      try {
        // Vue de la carte → PNG (fichier temporaire) ; `result: 'tmpfile'` rend une URI partageable.
        return await captureRef(cible as Parameters<typeof captureRef>[0], {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
      } catch {
        // Vue non montée / module indisponible → l'orchestration repliera sur le texte.
        return null;
      }
    },

    async partager(payload: PartagePayload): Promise<PartageRésultat> {
      // Image disponible : feuille de partage de fichier (expo-sharing, format social).
      if (payload.uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(payload.uri, {
          mimeType: 'image/png',
          dialogTitle: payload.titre,
          UTI: 'public.png',
        });
        return { statut: 'partagé', média: 'image' };
      }

      // Repli : feuille de partage native intégrée (RN core, sans dépendance).
      const contenu = payload.uri
        ? { message: payload.message, url: payload.uri, title: payload.titre }
        : { message: payload.message, title: payload.titre };
      const résultat = await Share.share(contenu);
      if (résultat.action === Share.dismissedAction) return { statut: 'annulé' };
      return { statut: 'partagé', média: payload.uri ? 'image' : 'texte' };
    },
  };
}
