import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine du module `guest-access` (lot 4.6, Architecture §5).
 */

/**
 * Accès invité introuvable **ou** hors de la portée de l'appelant : un octroi
 * qui n'appartient pas au coach (gestion), **ou** l'absence d'accès **actif** de
 * l'invité sur le cheval visé (lecture). **404 volontaire** dans tous les cas —
 * un octroi/cheval hors portée se comporte comme inexistant : **aucune fuite**
 * d'existence (un 403 révélerait qu'il existe), même posture que
 * `ChevalNotFoundError` (2.1). Le scoping est appliqué **dans la requête SQL**
 * (`compte_pro_id = …` pour le coach ; `invité_compte_id = … AND statut = actif`
 * pour l'invité), pas après coup — un accès **révoqué** cesse donc d'être lisible.
 */
export class AccèsInvitéNotFoundError extends DomainError {
  readonly status = 404;
  readonly publicMessage = 'Accès invité introuvable.';
  constructor() {
    super('Accès invité introuvable ou hors de la portée de l’appelant.');
  }
}

/**
 * Jeton d'invitation invalide, expiré ou **déjà utilisé** (acceptation). **400** :
 * la requête porte un jeton inexploitable (même posture que
 * `InvalidVerificationTokenError`, 1.2). Le message public dit quoi faire (en
 * redemander un au coach), sans révéler la cause.
 */
export class InvitationInvalideError extends DomainError {
  readonly status = 400;
  readonly publicMessage =
    'Cette invitation est invalide ou a expiré. Demande à ton coach de te réinviter.';
  constructor() {
    super('Jeton d’invitation invalide, expiré ou déjà consommé.');
  }
}

/**
 * Un accès **non révoqué** (en attente ou actif) existe déjà pour ce couple
 * (cheval, e-mail invité). **409 Conflict** : ré-inviter la **même** adresse sur
 * le **même** cheval entrerait en conflit avec l'octroi existant (on évite les
 * doublons fantômes). **Plusieurs** invités *différents* restent permis (Spec
 * §9.5) ; ré-inviter après **révocation** est permis (repart d'un octroi neuf).
 */
export class AccèsInvitéDéjàExistantError extends DomainError {
  readonly status = 409;
  readonly publicMessage = 'Cette personne a déjà un accès (ou une invitation) à ce cheval.';
  constructor() {
    super('Un accès invité non révoqué existe déjà pour ce couple (cheval, e-mail).');
  }
}
