import {
  type AuthTokens,
  type CompteSortie,
  compteSortieSchema,
  type LoginDto,
  type RegisterDto,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { compte } from '../db/schema';
import { EmailAlreadyUsedError, InvalidCredentialsError } from './auth.errors';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

/**
 * Service de domaine `auth-account` (Architecture §3) : règles métier de
 * l'inscription / connexion / rotation / déconnexion. Aucune dépendance HTTP ;
 * lève des erreurs de domaine typées (Architecture §5).
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly verification: VerificationService,
  ) {}

  /**
   * Inscription : crée un `Compte` avec mot de passe **haché argon2**,
   * `email_verified = false` et `tier = gratuit` (défauts serveur). Déclenche
   * l'**envoi du lien de vérification** (lot 1.2) via le port `Mailer` (stub
   * console en dev) — branchement **direct dans le flux** `register` (pas
   * d'event bus : pas d'abstraction prématurée, cf. journal 1.2). Renvoie la
   * projection publique (sans secret).
   */
  async register(dto: RegisterDto): Promise<CompteSortie> {
    const existing = await this.db
      .select({ id: compte.id })
      .from(compte)
      .where(eq(compte.email, dto.email))
      .limit(1);
    if (existing.length > 0) {
      throw new EmailAlreadyUsedError();
    }

    const password_hash = await this.passwords.hash(dto.password);
    const [row] = await this.db
      .insert(compte)
      .values({ email: dto.email, nom: dto.nom, password_hash, type: dto.type })
      .returning();

    await this.verification.issueEmailVerification({ id: row.id, email: row.email });

    // `compteSortieSchema` retire tout champ sensible (dont `password_hash`).
    return compteSortieSchema.parse(row);
  }

  /**
   * Connexion : renvoie un couple access + refresh sur identifiants valides,
   * sinon `401`. Le login est **autorisé indépendamment de `email_verified`** —
   * un éventuel gating de la vérification est une décision produit non tranchée
   * (hors lot 1.1).
   */
  async login(dto: LoginDto): Promise<AuthTokens> {
    const [row] = await this.db.select().from(compte).where(eq(compte.email, dto.email)).limit(1);

    const ok = await this.passwords.verify(row?.password_hash, dto.password);
    if (!row || !ok) {
      throw new InvalidCredentialsError();
    }

    return this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      type: row.type,
      tier: row.tier,
    });
  }

  /** Rotation : nouveau couple, ancien refresh invalidé (cf. `TokenService`). */
  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken);
  }

  /** Déconnexion : révoque le refresh courant. */
  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  /** Compte courant (route protégée) — projection publique, sans secret. */
  async currentAccount(compteId: string): Promise<CompteSortie> {
    const [row] = await this.db.select().from(compte).where(eq(compte.id, compteId)).limit(1);
    if (!row) {
      throw new InvalidCredentialsError();
    }
    return compteSortieSchema.parse(row);
  }
}
