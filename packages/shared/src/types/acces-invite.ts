import type { StatutAccèsInvité } from '../enums/acces-invite';
import type { ChampsTechniques } from './champs-techniques';

/**
 * **Accès invité** (Modèle §3, Spec §9.5, lot 4.6). Entité **spécifiée au Modèle
 * de données** mais **non posée en 0.3** (6 entités socle) : le lot 4.6 ajoute la
 * table (migration Drizzle) et **back-documente** l'entité (cf. journal), au même
 * titre que le Bilan augmenté (4.5).
 *
 * C'est un **accès en lecture seule** accordé par un compte **pro** à son client
 * sur **une** fiche cheval — **pas un partage de propriété** (Spec §9.2/§9.5) : le
 * cheval reste **détenu et saisi** par le coach. Un cheval peut porter **plusieurs**
 * accès (propriétaire + cavalier…) ; chacun **révocable** à tout moment.
 *
 * Forme de **domaine normalisée** (miroir fidèle de la ligne persistée, vérifié
 * par `alignment.spec.ts`, hors colonne technique `token_hash`). La projection de
 * **sortie** (vue coach / atterrissage invité) vit dans `schemas/acces-invite.ts`.
 *
 * - `cheval_id`        : le **cheval partagé** (1 Cheval, détenu par le pro).
 * - `compte_pro_id`    : le **compte pro** propriétaire qui a accordé l'accès —
 *   enregistré explicitement (« détenu par un compte pro », Modèle §3). Il **scope
 *   les lectures invité** au propriétaire sans relire la table `cheval` d'un autre
 *   module ; la propriété d'un cheval est **immuable** en v1 (Modèle §3), donc pas
 *   de dérive. Trace aussi *qui* a partagé (RGPD, accès traçable §9.5).
 * - `invité_email`     : l'**e-mail invité** (destinataire de l'invitation TEM).
 * - `invité_compte_id` : le **compte du client** une fois **relié** (à l'acceptation) ;
 *   absent tant que l'invitation est `en_attente` (l'invité = un compte régulier
 *   1.1 + un octroi scopé, Stack §3.4).
 * - `statut`           : `en_attente | actif | révoqué` (cycle ci-dessus).
 */
export interface AccèsInvité extends ChampsTechniques {
  cheval_id: string;
  compte_pro_id: string;
  invité_email: string;
  invité_compte_id?: string;
  statut: StatutAccèsInvité;
}
