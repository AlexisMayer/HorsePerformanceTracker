import { TIERS, type Tier } from '../enums/compte';

/**
 * **Politique d'entitlement** (lot 4.1, Spec §8 — synthèse du gating
 * gratuit/premium/pro). C'est la **donnée de politique pure** du gating, posée
 * dans `shared` (Architecture §2) pour que l'**app** (grisage, lot 4.2) et
 * l'**api** (garde + enforcement de quota) lisent **la même source** — une seule
 * implémentation, jamais dupliquée.
 *
 * Le gating reste l'**autorité serveur** (Architecture §5) : ce module ne fait
 * que *décrire* qui a droit à quoi ; c'est la garde de l'api qui *tranche*.
 * L'UI ne s'en sert que pour griser/inciter (4.2), jamais comme source de vérité.
 *
 * Deux familles, directement issues du tableau Spec §8 :
 *  - **Capacités** (booléennes) : fonctions payantes verrouillées → premium/pro.
 *  - **Quotas** (numériques) : plafonds de ressources (chevaux, combinaisons),
 *    `null` = **illimité**. (`null` plutôt que `Infinity` : sérialisable en JSON.)
 *
 * La **saisie**, la **boucle gratuite** (feed, héros, cartes) et l'**historique**
 * ne sont jamais verrouillés (Spec §8) → ils ne figurent pas dans la matrice :
 * une capacité n'existe ici que si elle peut être *refusée*.
 */

/**
 * Capacités gatées (Spec §8). Une capacité absente de cette liste n'est pas
 * gatée (toujours accessible). Clés en français, fidèles au référentiel (§8).
 *
 *  - `analytique_diagnostic` — heatmap type×hauteur, benchmark (premium/pro).
 *  - `bilan_augmenté`        — bilan de séance par l'assistant IA (premium/pro, §7).
 *  - `bilan_progression`     — rapport multi-séances exporté (premium/pro, §6).
 *  - `multi_chevaux`         — plus d'un cheval actif (pro).
 *  - `comptes_invité`        — accès client en lecture seule (pro, §9.5).
 */
export const CAPACITÉS = [
  'analytique_diagnostic',
  'bilan_augmenté',
  'bilan_progression',
  'multi_chevaux',
  'comptes_invité',
] as const;

export type Capacité = (typeof CAPACITÉS)[number];

/**
 * Clés de quota (Spec §8). `null` dans la matrice = **illimité**.
 *
 *  - `chevaux`      — chevaux **actifs** (1 / 1 / ∞). Le multi-chevaux est pro :
 *                     le quota et la capacité `multi_chevaux` disent la même chose
 *                     sous deux angles (plafond vs interrupteur).
 *  - `combinaisons` — taille de la bibliothèque de combinaisons réutilisables
 *                     (limitée / ∞ / ∞, Spec §4.4).
 */
export const QUOTAS = ['chevaux', 'combinaisons'] as const;

export type CléQuota = (typeof QUOTAS)[number];

/**
 * Plafond de la bibliothèque de combinaisons réutilisables en **gratuit**
 * (Spec §4.4 : « limitée en nombre », sans chiffre figé). Valeur retenue en
 * 4.1 : assez pour essayer la fonctionnalité, assez basse pour rester un levier
 * de conversion. **Source unique** : si le produit veut un autre plafond (ou le
 * rendre paramétrable côté tarifs, 4.2), il se change **ici** et app+api suivent.
 */
export const PLAFOND_COMBINAISONS_GRATUIT = 5;

/** Entitlement résolu d'un tier : ses capacités et ses quotas (`null` = illimité). */
export interface Entitlement {
  tier: Tier;
  capacités: Record<Capacité, boolean>;
  /** Plafond par ressource ; `null` = illimité. */
  quotas: Record<CléQuota, number | null>;
}

/**
 * **Matrice de gating** (Spec §8) — la traduction littérale du tableau de
 * synthèse. C'est la seule donnée à toucher quand le gating évolue.
 *
 * | Capacité / Quota        | gratuit | premium | pro |
 * |-------------------------|:-------:|:-------:|:---:|
 * | analytique_diagnostic   |    —    |    ✓    |  ✓  |
 * | bilan_augmenté (IA)     |    —    |    ✓    |  ✓  |
 * | bilan_progression       |    —    |    ✓    |  ✓  |
 * | multi_chevaux           |    —    |    —    |  ✓  |
 * | comptes_invité          |    —    |    —    |  ✓  |
 * | chevaux (quota)         |    1    |    1    |  ∞  |
 * | combinaisons (quota)    |    5    |    ∞    |  ∞  |
 */
export const MATRICE_ENTITLEMENT: Record<Tier, Omit<Entitlement, 'tier'>> = {
  gratuit: {
    capacités: {
      analytique_diagnostic: false,
      bilan_augmenté: false,
      bilan_progression: false,
      multi_chevaux: false,
      comptes_invité: false,
    },
    quotas: { chevaux: 1, combinaisons: PLAFOND_COMBINAISONS_GRATUIT },
  },
  premium: {
    capacités: {
      analytique_diagnostic: true,
      bilan_augmenté: true,
      bilan_progression: true,
      multi_chevaux: false,
      comptes_invité: false,
    },
    quotas: { chevaux: 1, combinaisons: null },
  },
  pro: {
    capacités: {
      analytique_diagnostic: true,
      bilan_augmenté: true,
      bilan_progression: true,
      multi_chevaux: true,
      comptes_invité: true,
    },
    quotas: { chevaux: null, combinaisons: null },
  },
};

/** Entitlement complet d'un tier (capacités + quotas), prêt à projeter/exposer. */
export function entitlementPourTier(tier: Tier): Entitlement {
  const { capacités, quotas } = MATRICE_ENTITLEMENT[tier];
  // Copies défensives : l'appelant ne peut pas muter la matrice partagée.
  return { tier, capacités: { ...capacités }, quotas: { ...quotas } };
}

/** Vrai si le tier débloque la capacité gatée (base de la garde d'entitlement). */
export function aLaCapacité(tier: Tier, capacité: Capacité): boolean {
  return MATRICE_ENTITLEMENT[tier].capacités[capacité];
}

/** Plafond du tier pour une ressource ; `null` = illimité. */
export function quotaPour(tier: Tier, clé: CléQuota): number | null {
  return MATRICE_ENTITLEMENT[tier].quotas[clé];
}

/**
 * Vrai s'il **reste de la place pour une ressource de plus**, sachant qu'il y en
 * a déjà `countActuel`. Base de l'enforcement de quota côté serveur (la création
 * de la (countActuel+1)-ième ressource est autorisée si `countActuel < plafond`,
 * ou si le plafond est illimité). Un `countActuel` négatif est traité comme 0.
 */
export function peutCréer(tier: Tier, clé: CléQuota, countActuel: number): boolean {
  const plafond = quotaPour(tier, clé);
  if (plafond === null) return true;
  return Math.max(0, countActuel) < plafond;
}

/** Garde d'exhaustivité : `TIERS` couvre bien toutes les clés de la matrice. */
const _tousLesTiersCouverts: readonly Tier[] = TIERS;
void _tousLesTiersCouverts;
