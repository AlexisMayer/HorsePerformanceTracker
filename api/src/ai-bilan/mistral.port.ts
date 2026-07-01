import type { Provenance, TypeSéance } from '@hpt/shared';

/**
 * **Port Mistral** (lot 4.5, Stack §3.6) — la frontière d'I/O de l'assistant IA
 * isolée derrière une interface étroite et **injectable** (même posture que le
 * port Mollie de 4.2, le port de rendu de 4.4, le port de partage de 3.3). Le
 * service `ai-bilan` n'orchestre que **ces types** : il se teste avec un **stub**
 * déterministe (in-memory, sans réseau ni clé) et le **vrai client** Mistral
 * (`MistralHttpClient`) est câblé **par env** en prod — jamais importé par un
 * test. **Consigne** : le sandbox de dev n'atteint pas Mistral → stub par défaut.
 *
 * **Sortie = texte consultatif** (Spec §7.2), **jamais une métrique** (Modèle
 * §1) : l'analyse et les recommandations sont des chaînes, elles n'alimentent
 * aucun agrégat.
 */

/** Jeton d'injection de l'implémentation du port (stub en dev/test, http en prod). */
export const MISTRAL = Symbol('MISTRAL');

/**
 * Matière **narrative** d'une séance envoyée à l'IA (Spec §7.2) : la couche
 * **objective** (faits) **et** la couche **contexte qualitatif** (ressenti,
 * énergie, note). Autorisé car la sortie est un **texte**, pas un agrégat
 * (Modèle §1). `null` quand le fait ne s'applique pas (ex. Plat = 0 hauteur).
 */
export interface SéanceContexteIA {
  date: string;
  type: TypeSéance;
  provenance: Provenance;
  hauteur_max: number | null;
  efforts_propres: number | null;
  efforts_totaux: number | null;
  taux_réussite: number | null;
  sans_faute: boolean | null;
  ressenti_global: number | null;
  énergie: number | null;
  note: string | null;
}

/**
 * Contexte fourni à l'IA (Spec §7.2) : la **dernière séance** (celle analysée) +
 * les **précédentes** comme matière de comparaison. Aucun identifiant de compte
 * ni PII n'est transmis (minimisation RGPD, Stack §7.2).
 */
export interface ContexteBilanIA {
  dernière: SéanceContexteIA;
  précédentes: SéanceContexteIA[];
}

/**
 * Le bilan **généré** par l'IA. `modèle`/`version` sont ceux **effectivement
 * appelés** (épinglés, Stack §3.6) — le service les **persiste** tels quels
 * (auditabilité). `analyse` + `recommandations` sont le contenu consultatif.
 */
export interface BilanAugmentéGénéré {
  modèle: string;
  version: string;
  analyse: string;
  recommandations: string;
}

/** Frontière d'I/O Mistral — la seule dépendance du service vers l'IA. */
export interface MistralPort {
  /** Génère le bilan augmenté d'une séance à partir du contexte fourni. */
  générerBilan(contexte: ContexteBilanIA): Promise<BilanAugmentéGénéré>;
}
