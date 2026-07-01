import type { FormatBilan } from '@hpt/shared';

/**
 * **Port de rendu du bilan** (lot 4.4, Stack §5) — la frontière d'I/O du pipeline
 * de génération, isolée derrière une interface étroite et **injectable** (même
 * posture que le port Mollie de 4.2 ou le port de partage de 3.3). Le service ne
 * dépend que de **cette** interface : il se teste et tourne en dev avec un
 * adaptateur **local/stub**, sans dépendance lourde.
 *
 * **Deux implémentations, une seule couture** :
 *  - **dev / DoD** : `LocalBilanRender` — écrit le **document HTML** en fichier
 *    **local** et renvoie une URL `file://` (le lien web autonome). Le PDF y est
 *    un **stub** (le HTML sert de substitut), car…
 *  - **prod (différé infra, non bloquant DoD)** : `HTML+CSS → PDF via Playwright`
 *    en **Serverless Job**, poussé sur **Object Storage**, servi par **URL
 *    présignée** (Stack §5). Cet adaptateur se branche **ici** sans toucher au
 *    service ni à la composition — c'est un point de **déploiement**, pas de logique
 *    métier (cf. journal).
 */

/** Jeton d'injection de l'implémentation du port (local/stub en dev, prod plus tard). */
export const BILAN_RENDER = Symbol('BILAN_RENDER');

/** Le document à matérialiser : le HTML autonome, un nom de base, le format visé. */
export interface BilanDocument {
  html: string;
  /** Base du nom de fichier (sans extension) — l'adaptateur l'assainit. */
  nomFichier: string;
  format: FormatBilan;
}

/** L'artefact matérialisé : où le trouver, son type, sa taille, s'il est un stub. */
export interface BilanArtefactRendu {
  url: string;
  type_contenu: string;
  taille_octets: number;
  /** Vrai quand la sortie est un substitut de dev (PDF rendu en HTML local). */
  stub: boolean;
}

/** Frontière de rendu — la seule dépendance du service vers la sortie/le stockage. */
export interface BilanRenderPort {
  render(doc: BilanDocument): Promise<BilanArtefactRendu>;
}
