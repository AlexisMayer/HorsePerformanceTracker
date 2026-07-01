/**
 * Référentiel de l'**Accès invité** (Modèle §3, Spec §9.5, lot 4.6) — le statut
 * du cycle de vie d'un octroi de lecture seule accordé par un compte **pro** à
 * son client sur **une** fiche cheval.
 *
 * Trois états, un cycle simple :
 *  - `en_attente` — le coach a invité (par e-mail) ; le client n'a **pas encore**
 *    relié son compte (jeton d'invitation non consommé). Aucune lecture possible.
 *  - `actif`      — le client a **accepté** (jeton consommé, compte relié) ; il
 *    consulte le cheval partagé en **lecture seule** (feed/héros/historique/
 *    analytique).
 *  - `révoqué`    — le coach a **coupé** l'accès (à tout moment) ; toute lecture
 *    cesse. Terminal (on ré-invite plutôt que de « ré-activer »).
 *
 * Liste figée, réutilisée par le schéma Zod **et** l'enum Postgres (aucune
 * redéclaration — alignement §2).
 */

export const STATUTS_ACCÈS_INVITÉ = ['en_attente', 'actif', 'révoqué'] as const;

export type StatutAccèsInvité = (typeof STATUTS_ACCÈS_INVITÉ)[number];
