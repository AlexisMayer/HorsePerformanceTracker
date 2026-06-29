/**
 * Tranche `sharing` de l'app (lot 3.3) — la **carte de bilan de séance simple**
 * (Spec §5.4, UI/UX §6.6), **proposée à l'enregistrement** par-dessus la
 * confirmation « Enregistré » de 2.3 (`[ Partager ] / [ Plus tard ]`), avec le
 * **record mis en avant** (laiton) s'il y en a un. **Export image** (rendu de la
 * carte + feuille de partage native) via un **port injectable**. Gratuite, jamais
 * verrouillée (tous comptes — §8).
 *
 * Carte de séance **simple** uniquement : **distincte** du bilan augmenté IA (4.5)
 * et du bilan de progression (4.4) — trois objets (Spec §8). Pas d'IA, pas de PDF.
 *
 * Les helpers d'affichage (`card-format`) et l'orchestration du partage
 * (`share-card`) sont **purs** (testés par Vitest) ; tout le calcul (récap §7/§9,
 * record 3.1) vit dans `shared` — jamais ici (Architecture §2). L'I/O natif
 * (capture + partage) est isolé derrière `CartePartagePort`.
 */
export { BilanCard, type BilanCardProps } from './bilan-card';
export {
  formatCarteDate,
  fractionRéussie,
  hauteursRésumé,
  messagePartage,
  nomFichierCarte,
  travailRésumé,
} from './card-format';
export type {
  CartePartagePort,
  CibleCapture,
  PartagePayload,
  PartageRésultat,
} from './card-share-port';
export { createNativeCartePartagePort } from './native-card-share-port';
export { partagerCarte } from './share-card';
export { ShareProposal, type ShareProposalProps } from './share-proposal';
export { createSharingApi, type SharingApi } from './sharing-api';
export { type ShareCard, useShareCard } from './use-share-card';
