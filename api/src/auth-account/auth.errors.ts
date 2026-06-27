import { DomainError } from '../common/domain-error';

/**
 * Erreurs de domaine de l'auth (Architecture §5). Messages publics volontairement
 * **génériques** : on ne révèle ni l'existence d'un compte, ni le détail d'un
 * échec de jeton.
 */

export class EmailAlreadyUsedError extends DomainError {
  readonly status = 409;
  readonly publicMessage = 'Cet e-mail est déjà utilisé.';
  constructor() {
    super('Inscription refusée : e-mail déjà enregistré.');
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly status = 401;
  readonly publicMessage = 'Identifiants invalides.';
  constructor() {
    super('Échec d’authentification : e-mail ou mot de passe invalide.');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly status = 401;
  readonly publicMessage = 'Session expirée, veuillez vous reconnecter.';
  constructor() {
    super('Refresh token invalide, expiré ou révoqué.');
  }
}

export class RefreshTokenReuseError extends DomainError {
  readonly status = 401;
  readonly publicMessage = 'Session expirée, veuillez vous reconnecter.';
  constructor() {
    super('Réutilisation d’un refresh token déjà tourné : famille révoquée.');
  }
}
