/**
 * Config du module **`ai-bilan`** (lot 4.5, Stack §3.6) — décisions tranchées,
 * lues de l'environnement. Deux familles :
 *
 *  - **Modèle Mistral épinglé** : `modèle` (famille, ex. `mistral-small`) +
 *    `version` (identifiant **épinglé** appelé, ex. `mistral-small-2409`) —
 *    **jamais** un alias `-latest` (évite la dérive de modèle, Stack §3.6). La
 *    valeur exacte est traçée sur chaque bilan (auditabilité).
 *  - **Rate limiting + garde-fous de coût** : nombre maximal de **générations**
 *    (appels IA effectifs) par utilisateur sur une fenêtre glissante. Une
 *    relecture ne consomme rien (get-or-create), donc seul un **nouvel** appel
 *    compte.
 *
 * **Clé API** : `MISTRAL_API_KEY` vient du **Secret Manager** en prod (Stack
 * §3.5) ; **sans clé**, le module bascule sur le **stub déterministe** (le
 * sandbox de dev n'atteint pas Mistral — consigne). Comme les tarifs Mollie
 * (4.2), rien n'est codé en dur ailleurs que dans ce loader.
 */
export interface AiBilanConfig {
  /** Famille de modèle Mistral (ex. `mistral-small`). */
  modèle: string;
  /** Version **épinglée** appelée (ex. `mistral-small-2409`) — jamais `-latest`. */
  version: string;
  /** Clé API Mistral (La Plateforme, UE). `null` ⇒ **stub** déterministe (dev/test). */
  apiKey: string | null;
  /** URL de base de l'API Mistral (surchargée en test/prod si besoin). */
  baseUrl: string;
  /** Rate limiting par utilisateur : nb max de générations sur `fenêtreMs`. */
  rateLimitMax: number;
  /** Fenêtre glissante du rate limiting, en millisecondes. */
  rateLimitFenêtreMs: number;
}

/**
 * Défauts **dev** (jamais des paramètres de prod) — même posture que les secrets
 * JWT dev (1.1) ou les tarifs Mollie (4.2). Le modèle est **épinglé** par défaut
 * (pas de `-latest`) ; le rate limit est généreux mais borné (garde-fou de coût).
 */
const DEV_DEFAULTS = {
  modèle: 'mistral-small',
  // Version épinglée par défaut (Mistral Small) — jamais un alias `-latest`.
  version: 'mistral-small-2409',
  baseUrl: 'https://api.mistral.ai',
  rateLimitMax: 10,
  rateLimitFenêtreMs: 60 * 60 * 1000, // 1 h
} as const;

/** Parse un entier d'env strictement positif, sinon retombe sur le défaut. */
function entierPositif(raw: string | undefined, défaut: number): number {
  if (raw === undefined) return défaut;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : défaut;
}

/** Charge la config `ai-bilan` depuis l'environnement (paramétrable, non figée). */
export function loadAiBilanConfig(): AiBilanConfig {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  return {
    modèle: process.env.AI_BILAN_MODEL ?? DEV_DEFAULTS.modèle,
    version: process.env.AI_BILAN_MODEL_VERSION ?? DEV_DEFAULTS.version,
    apiKey: apiKey && apiKey.length > 0 ? apiKey : null,
    baseUrl: process.env.MISTRAL_BASE_URL ?? DEV_DEFAULTS.baseUrl,
    rateLimitMax: entierPositif(process.env.AI_BILAN_RATE_LIMIT, DEV_DEFAULTS.rateLimitMax),
    rateLimitFenêtreMs: entierPositif(
      process.env.AI_BILAN_RATE_WINDOW_MS,
      DEV_DEFAULTS.rateLimitFenêtreMs,
    ),
  };
}

/** Jeton d'injection de la config `ai-bilan` (résolue une fois, au démarrage). */
export const AI_BILAN_CONFIG = Symbol('AI_BILAN_CONFIG');
