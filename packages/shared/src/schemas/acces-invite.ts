import { z } from 'zod';
import { STATUTS_ACCÈS_INVITÉ } from '../enums/acces-invite';

/**
 * Contrats `shared` de l'**Accès invité** (lot 4.6, module `guest-access`, Spec
 * §9.5, Modèle §3). Source de vérité unique partagée app/api (Architecture
 * §1/§2) ; aucun type dupliqué. Le module `guest-access` valide ces schémas à
 * chaque frontière (Architecture §5).
 *
 * Deux publics, deux surfaces :
 *  - le **coach pro** invite/liste/révoque (`*Inviter`, `*Sortie`) ;
 *  - le **client invité** accepte puis consulte (`*Accepter`, `ChevalPartagé`).
 *
 * **Aucun secret ne sort** : le jeton d'invitation (SHA-256 en base) n'apparaît
 * dans **aucun** DTO — il ne vit que dans le lien e-mail (TEM en prod, stub log
 * en dev, cf. `Mailer`). Le `.strip()` par défaut de Zod retire toute clé
 * inattendue de la ligne persistée (dont `token_hash`).
 */

/** Statut de l'accès (miroir Zod de l'enum figé `STATUTS_ACCÈS_INVITÉ`). */
export const statutAccèsInvitéSchema = z.enum(STATUTS_ACCÈS_INVITÉ);

/**
 * DTO d'**entrée** — le coach **invite** un client (par e-mail) sur un cheval.
 *
 * Le cheval vient de l'URL (`/horses/:id/guest-access`) et le compte pro du
 * jeton ; seul l'e-mail invité est dans le corps. **Plusieurs** invitations par
 * cheval sont permises (propriétaire + cavalier…), donc aucune unicité imposée
 * ici — c'est un ajout à la liste des accès du cheval.
 */
export const accèsInvitéInviterSchema = z.object({
  email: z.string().email(),
});

export type AccèsInvitéInviterDto = z.infer<typeof accèsInvitéInviterSchema>;

/**
 * DTO d'**entrée** — le client **accepte** une invitation via le **jeton** reçu
 * par e-mail (capacité au porteur, comme la vérification d'e-mail / le reset de
 * 1.2). L'appelant est **déjà authentifié** (compte régulier 1.1) ; l'acceptation
 * **relie** son compte à l'octroi et le passe en `actif`.
 */
export const accèsInvitéAccepterSchema = z.object({
  token: z.string().min(1),
});

export type AccèsInvitéAccepterDto = z.infer<typeof accèsInvitéAccepterSchema>;

/**
 * DTO de **sortie** — projection d'un accès pour la **vue de gestion du coach**
 * (liste des invités d'un cheval). Ne porte **aucun** secret (pas de jeton, pas
 * d'id de compte invité brut) : `invité_relié` **dérive** de la présence d'un
 * compte relié (l'invitation a-t-elle été acceptée ?) sans exposer l'identifiant.
 * `created_at` permet d'ordonner/afficher l'ancienneté (rendu en `Date`, sérialisé
 * par la frontière HTTP).
 */
export const accèsInvitéSortieSchema = z.object({
  id: z.string(),
  cheval_id: z.string(),
  invité_email: z.string().email(),
  invité_relié: z.boolean(),
  statut: statutAccèsInvitéSchema,
  created_at: z.date(),
});

export type AccèsInvitéSortie = z.infer<typeof accèsInvitéSortieSchema>;

/**
 * DTO de **sortie** — le **cheval partagé** tel que le voit l'**invité** : le
 * strict nécessaire à sa **coquille en lecture seule** (en-tête + scope des
 * lectures). **Rien de la fiche** au-delà du nom (ni propriétaire, ni autres
 * chevaux) — accès **scopé à UN cheval** (Spec §9.5, Stack §3.4). Renvoyé par
 * l'acceptation (où atterrir) et par la liste des accès de l'invité (`me`).
 */
export const chevalPartagéSchema = z.object({
  cheval_id: z.string(),
  cheval_nom: z.string(),
});

export type ChevalPartagé = z.infer<typeof chevalPartagéSchema>;
