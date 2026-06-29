/**
 * **Port de partage de carte** (lot 3.3) — la frontière d'I/O native isolée
 * derrière une interface étroite et **injectable** (même posture que le store de
 * brouillon de 2.3 : la logique reste testable en Node, l'implémentation native
 * est un fin adaptateur). L'**orchestration** (`share-card.ts`) ne dépend que de
 * ces types — **aucun** import React Native ici — donc elle se teste avec un faux
 * port, sans rendu ni module natif.
 *
 * Deux capacités : **capturer** la vue de la carte en image, puis **partager**
 * (feuille de partage native). La capture peut échouer/être indisponible : le port
 * renvoie alors `null`, et l'orchestration **replie sur le partage texte** — le
 * partage natif reste fonctionnel partout (RN core), l'image est un bonus.
 */

/**
 * Cible de capture : la **vue** de la carte. Opaque ici (l'adaptateur natif sait
 * que c'est une ref de vue) — garde ce port libre de toute dépendance RN.
 */
export type CibleCapture = unknown;

/**
 * Charge utile de partage : l'**image** capturée (`uri`, `null` si indisponible)
 * et un **repli texte** (`message`) toujours présent. `titre` nomme la feuille de
 * partage (Android).
 */
export interface PartagePayload {
  uri: string | null;
  message: string;
  titre: string;
}

/**
 * Résultat d'une tentative de partage — **jamais** une exception pour une
 * annulation utilisateur (fermer la feuille n'est pas une erreur). `média`
 * distingue le partage image du repli texte.
 */
export type PartageRésultat =
  | { statut: 'partagé'; média: 'image' | 'texte' }
  | { statut: 'annulé' }
  | { statut: 'indisponible' };

/** Port injectable du partage de carte (capture + feuille de partage native). */
export interface CartePartagePort {
  /** Capture la cible (vue de la carte) en image ; `null` si indisponible. */
  capturer(cible: CibleCapture): Promise<string | null>;
  /** Ouvre la feuille de partage native (image si `uri`, sinon texte). */
  partager(payload: PartagePayload): Promise<PartageRésultat>;
}
