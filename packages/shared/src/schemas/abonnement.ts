import { z } from 'zod';
import type { Tier } from '../enums/compte';

/**
 * Contrats de l'**abonnement & upgrade in-app** (lot 4.2, Spec §9.3, Stack §6).
 * DTO partagés du flux Mollie : démarrage du **checkout**, lecture de l'**état**
 * d'abonnement (pour l'état *pending* honnête et le déverrouillage) et des
 * **offres** (montants paramétrables, lus de la config serveur — jamais en dur).
 *
 * Le **gating reste l'autorité serveur** (4.1) : ces DTO ne décident rien ; ils
 * transportent ce que l'app affiche (paywall, état pending) et ce que l'app
 * demande (créer un checkout, lire l'état). Le **webhook Mollie** — pas ces
 * DTO — fait foi du changement de tier (cf. journal 4.2).
 *
 * **RGPD / minimisation** (Stack §6/§7.2) : rien ici ne porte de donnée de
 * cheval ; seul l'e-mail du compte est transmis à Mollie, **côté serveur**, hors
 * de ces contrats.
 */

/**
 * **Tiers payants** souscriptibles : `premium` (mono-cheval) et `pro`
 * (multi-chevaux + invités). `gratuit` n'est **pas** souscriptible — on ne crée
 * jamais un checkout « vers gratuit ». Sous-ensemble strict de `TIERS` (garde
 * d'exhaustivité en bas de fichier).
 */
export const TIERS_PAYANTS = ['premium', 'pro'] as const;

export type TierPayant = (typeof TIERS_PAYANTS)[number];

export const tierPayantSchema = z.enum(TIERS_PAYANTS);

/**
 * **Statut d'abonnement** — miroir app, honnête, du cycle Mollie/SEPA :
 *  - `en_attente` — checkout lancé / mandat SEPA non encore confirmé (l'UI
 *    affiche un état *pending*, le tier **n'est pas** élevé) ;
 *  - `actif`      — paiement/mandat confirmé par **webhook** → tier élevé ;
 *  - `annulé`     — résiliation ;
 *  - `échoué`     — paiement refusé/expiré/annulé côté Mollie.
 *
 * Le passage à `actif` n'arrive **qu'au webhook** (autorité serveur, §6) — le
 * retour client ne fait que **re-lire** cet état.
 */
export const STATUTS_ABONNEMENT = ['en_attente', 'actif', 'annulé', 'échoué'] as const;

export type StatutAbonnement = (typeof STATUTS_ABONNEMENT)[number];

export const statutAbonnementSchema = z.enum(STATUTS_ABONNEMENT);

/** Entrée : démarrer un checkout d'upgrade vers un tier payant (premium/pro). */
export const checkoutDemandeSchema = z.object({ tier_cible: tierPayantSchema });

export type CheckoutDemandeDto = z.infer<typeof checkoutDemandeSchema>;

/**
 * Sortie : l'**URL de checkout Mollie** (à ouvrir en navigateur in-app/externe)
 * + l'`id` de l'abonnement créé (statut `en_attente`). Le tier **n'est pas**
 * encore élevé : il le sera au **webhook** confirmant (§6).
 */
export const checkoutSortieSchema = z.object({
  checkout_url: z.string().url(),
  abonnement_id: z.string().uuid(),
});

export type CheckoutSortie = z.infer<typeof checkoutSortieSchema>;

/**
 * Sortie : l'**abonnement courant** du compte (le plus récent), ou `null` si
 * aucun. Pilote l'état *pending* (`en_attente`) vs *déverrouillé* (`actif`) au
 * retour du checkout. Volontairement minimal (statut + cible) — pas de donnée
 * Mollie interne exposée.
 */
export const abonnementSortieSchema = z.object({
  statut: statutAbonnementSchema,
  tier_cible: tierPayantSchema,
});

export type AbonnementSortie = z.infer<typeof abonnementSortieSchema>;

/**
 * Sortie : l'**état d'abonnement** du compte + l'**URL de gestion Mollie**
 * (renvoi vers l'espace Mollie pour gérer/résilier, Spec §9.3). `gestion_url`
 * est `null` tant qu'aucune gestion n'est disponible (ex. compte sans
 * abonnement). Re-validée au bord de l'app (scalaires uniquement).
 */
export const abonnementStatutSortieSchema = z.object({
  abonnement: abonnementSortieSchema.nullable(),
  gestion_url: z.string().url().nullable(),
});

export type AbonnementStatutSortie = z.infer<typeof abonnementStatutSortieSchema>;

/**
 * Sortie : une **offre tarifaire** d'un tier payant. Le **montant** vient de la
 * **config serveur** (env, paramétrable, Stack §6/§9.4) — jamais figé côté app.
 * `montant` est la valeur décimale Mollie (`"9.99"`), `devise` un code ISO-4217
 * (`"EUR"`), `intervalle` la cadence Mollie (`"1 month"`).
 */
export const offreSortieSchema = z.object({
  tier: tierPayantSchema,
  montant: z.string(),
  devise: z.string().length(3),
  intervalle: z.string(),
});

export type OffreSortie = z.infer<typeof offreSortieSchema>;

/** Sortie : la liste des offres proposées au paywall (premium/pro). */
export const offresSortieSchema = z.object({ offres: z.array(offreSortieSchema) });

export type OffresSortie = z.infer<typeof offresSortieSchema>;

/**
 * Garde d'exhaustivité (compile-time) : les **tiers payants** sont bien un
 * sous-ensemble de `Tier` — un libellé qui sortirait du référentiel `TIERS`
 * casserait la compilation ici.
 */
const _tiersPayantsSontDesTiers: readonly Tier[] = TIERS_PAYANTS;
void _tiersPayantsSontDesTiers;
