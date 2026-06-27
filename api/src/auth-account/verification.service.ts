import { randomBytes } from 'node:crypto';
import { type CompteSortie, compteSortieSchema } from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { compte, verificationToken } from '../db/schema';
import type { VerificationTokenType } from '../db/schema/verification-token';
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  loadVerificationLinkConfig,
  PASSWORD_RESET_TTL_SECONDS,
  type VerificationLinkConfig,
} from './auth.config';
import { InvalidVerificationTokenError } from './auth.errors';
import { MAILER, type Mailer } from './mailer/mailer';
import { PasswordService } from './password.service';
import { sha256Hex } from './sha256';
import { TokenService } from './token.service';

/** Compte minimal manipulé par le service (sélection ciblée, sans secret). */
interface AccountRef {
  id: string;
  email: string;
  email_verified: boolean;
}

/**
 * Service de domaine de la **vérification d'e-mail** et de la
 * **réinitialisation de mot de passe** (lot 1.2, module `auth-account`). Émet
 * des liens **à usage unique et expirables** (table `verification_token`),
 * envoyés via le **port `Mailer`** (stub console en dev). Aucune dépendance
 * HTTP ; lève des erreurs de domaine typées (Architecture §5).
 *
 * Anti-énumération : les *demandes* (renvoi de vérification, reset) ne révèlent
 * **jamais** l'existence d'un compte — l'appelant répond 200 quoi qu'il arrive,
 * et le lien n'est émis que si le compte existe (et, pour la vérification, n'est
 * pas déjà vérifié).
 */
@Injectable()
export class VerificationService {
  private readonly links: VerificationLinkConfig = loadVerificationLinkConfig();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /**
   * Émet et envoie un lien de vérification pour un compte connu. Appelé par le
   * **hook d'inscription** (branché directement sur le `register` de 1.1, cf.
   * `AuthService`) et par le renvoi. Idempotent côté usage : émettre invalide
   * les liens de vérification non consommés antérieurs.
   */
  async issueEmailVerification(account: { id: string; email: string }): Promise<void> {
    const link = await this.createLink(
      account.id,
      'email_verification',
      EMAIL_VERIFICATION_TTL_SECONDS,
      this.links.emailVerificationPath,
    );
    await this.mailer.sendEmailVerification({ to: account.email, link });
  }

  /**
   * Demande de **renvoi** du lien de vérification (anti-énumération : 200
   * systématique). N'envoie un lien que si le compte existe **et** n'est pas
   * déjà vérifié.
   */
  async requestEmailVerification(email: string): Promise<void> {
    const account = await this.findAccountByEmail(email);
    if (account && !account.email_verified) {
      await this.issueEmailVerification(account);
    }
  }

  /**
   * Confirme la vérification : consomme le jeton (usage unique, non expiré) et
   * passe `email_verified` à `true`. Renvoie la projection publique du compte.
   */
  async confirmEmailVerification(token: string): Promise<CompteSortie> {
    const consumed = await this.consume(token, 'email_verification');
    const [row] = await this.db
      .update(compte)
      .set({ email_verified: true })
      .where(eq(compte.id, consumed.compte_id))
      .returning();
    return compteSortieSchema.parse(row);
  }

  /**
   * Demande de **réinitialisation** de mot de passe (anti-énumération : 200
   * systématique). N'envoie le lien que si le compte existe.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const account = await this.findAccountByEmail(email);
    if (!account) {
      return;
    }
    const link = await this.createLink(
      account.id,
      'password_reset',
      PASSWORD_RESET_TTL_SECONDS,
      this.links.passwordResetPath,
    );
    await this.mailer.sendPasswordReset({ to: account.email, link });
  }

  /**
   * Confirme la réinitialisation : consomme le jeton, **re-hache** le nouveau
   * mot de passe en argon2 et **révoque tous les refresh tokens** du compte
   * (toute session ouverte tombe).
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const consumed = await this.consume(token, 'password_reset');
    const password_hash = await this.passwords.hash(newPassword);
    await this.db.update(compte).set({ password_hash }).where(eq(compte.id, consumed.compte_id));
    await this.tokens.revokeAllForAccount(consumed.compte_id);
  }

  /**
   * Crée une ligne `verification_token` et renvoie le **lien porteur du jeton**
   * en clair (jamais persisté : seul son SHA-256 l'est). Invalide d'abord les
   * jetons non consommés du même type pour ce compte (un seul lien actif à la
   * fois → un renvoi périme le précédent).
   */
  private async createLink(
    compteId: string,
    type: VerificationTokenType,
    ttlSeconds: number,
    path: string,
  ): Promise<string> {
    const secret = randomBytes(32).toString('base64url');
    const now = new Date();

    await this.db
      .update(verificationToken)
      .set({ consumed_at: now })
      .where(
        and(
          eq(verificationToken.compte_id, compteId),
          eq(verificationToken.type, type),
          isNull(verificationToken.consumed_at),
        ),
      );
    await this.db.insert(verificationToken).values({
      compte_id: compteId,
      type,
      token_hash: sha256Hex(secret),
      expires_at: new Date(now.getTime() + ttlSeconds * 1000),
    });

    return `${this.links.baseUrl}${path}?token=${secret}`;
  }

  /**
   * Consomme atomiquement un jeton du type attendu : un seul UPDATE conditionnel
   * (`consumed_at IS NULL` **et** non expiré) pose `consumed_at` et renvoie la
   * ligne. Toute absence de ligne (jeton inconnu, déjà consommé, expiré, mauvais
   * type) → erreur de domaine. L'atomicité ferme la fenêtre d'usage multiple.
   */
  private async consume(
    presented: string,
    type: VerificationTokenType,
  ): Promise<{ compte_id: string }> {
    const now = new Date();
    const [row] = await this.db
      .update(verificationToken)
      .set({ consumed_at: now })
      .where(
        and(
          eq(verificationToken.token_hash, sha256Hex(presented)),
          eq(verificationToken.type, type),
          isNull(verificationToken.consumed_at),
          gt(verificationToken.expires_at, now),
        ),
      )
      .returning({ compte_id: verificationToken.compte_id });
    if (!row) {
      throw new InvalidVerificationTokenError();
    }
    return row;
  }

  private async findAccountByEmail(email: string): Promise<AccountRef | undefined> {
    const [row] = await this.db
      .select({ id: compte.id, email: compte.email, email_verified: compte.email_verified })
      .from(compte)
      .where(eq(compte.email, email))
      .limit(1);
    return row;
  }
}
