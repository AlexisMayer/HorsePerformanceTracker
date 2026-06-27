import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthTokens, Tier, TypeCompte } from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { compte, refreshToken } from '../db/schema';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AuthSecrets,
  loadAuthSecrets,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.config';
import { InvalidRefreshTokenError, RefreshTokenReuseError } from './auth.errors';
import { sha256Hex } from './sha256';

/** Identité minimale embarquée dans l'access token et exposée à la garde. */
export interface CompteClaims {
  id: string;
  email: string;
  type: TypeCompte;
  tier: Tier;
}

interface RefreshJwtPayload {
  sub: string;
  fid: string;
  typ: 'refresh';
  jti: string;
}

/**
 * Émission et cycle de vie des jetons (Stack §3.4) : access + refresh JWT, avec
 * **rotation** des refresh et **détection de réutilisation par famille**.
 *
 * Le refresh est un JWT signé (secret distinct de l'access) dont le `jti` est
 * l'`id` de la ligne `refresh_token`. On ne stocke que le **SHA-256** du token
 * (jamais le clair) : le secret est de haute entropie (signature), un hash
 * rapide suffit — argon2 reste réservé au mot de passe.
 */
@Injectable()
export class TokenService {
  private readonly secrets: AuthSecrets = loadAuthSecrets();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  /** Couple frais pour une **nouvelle** session (login) : nouvelle famille. */
  async issueTokenPair(claims: CompteClaims): Promise<AuthTokens> {
    const { tokens } = await this.mintPair(claims, randomUUID());
    return tokens;
  }

  /**
   * Rotation : valide le refresh présenté, **invalide** la ligne courante et
   * émet un nouveau couple dans la **même famille**. Réutiliser un refresh déjà
   * tourné déclenche la révocation de toute la famille.
   */
  async rotate(presented: string): Promise<AuthTokens> {
    const payload = await this.verifyRefresh(presented);
    const [row] = await this.db
      .select()
      .from(refreshToken)
      .where(eq(refreshToken.id, payload.jti))
      .limit(1);

    if (!row || !this.matches(row.token_hash, this.sha256(presented))) {
      throw new InvalidRefreshTokenError();
    }

    if (row.revoked_at !== null) {
      // Un token déjà *tourné* puis re-présenté = fuite probable → on tue la famille.
      if (row.rotated_at !== null) {
        await this.revokeFamily(row.family_id);
        throw new RefreshTokenReuseError();
      }
      throw new InvalidRefreshTokenError();
    }
    if (row.expires_at.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenError();
    }

    const [account] = await this.db
      .select({ id: compte.id, email: compte.email, type: compte.type, tier: compte.tier })
      .from(compte)
      .where(eq(compte.id, row.compte_id))
      .limit(1);
    if (!account) {
      throw new InvalidRefreshTokenError();
    }

    const { tokens, refreshId } = await this.mintPair(account, row.family_id);
    const now = new Date();
    await this.db
      .update(refreshToken)
      .set({ revoked_at: now, rotated_at: now, replaced_by: refreshId })
      .where(eq(refreshToken.id, row.id));
    return tokens;
  }

  /**
   * Révoque **tous** les refresh tokens actifs d'un compte (lot 1.2). Appelé à
   * la réinitialisation du mot de passe : toute session ouverte est invalidée
   * (mesure de sécurité — un attaquant ayant pu être actif ne survit pas au
   * reset).
   */
  async revokeAllForAccount(compteId: string): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revoked_at: new Date() })
      .where(and(eq(refreshToken.compte_id, compteId), isNull(refreshToken.revoked_at)));
  }

  /** Déconnexion : révoque le refresh présenté (best-effort, sans rien révéler). */
  async revoke(presented: string): Promise<void> {
    let payload: RefreshJwtPayload;
    try {
      payload = await this.verifyRefresh(presented);
    } catch {
      return;
    }
    const [row] = await this.db
      .select()
      .from(refreshToken)
      .where(eq(refreshToken.id, payload.jti))
      .limit(1);
    if (!row || row.revoked_at !== null || !this.matches(row.token_hash, this.sha256(presented))) {
      return;
    }
    await this.db
      .update(refreshToken)
      .set({ revoked_at: new Date() })
      .where(eq(refreshToken.id, row.id));
  }

  private async mintPair(
    claims: CompteClaims,
    familyId: string,
  ): Promise<{ tokens: AuthTokens; refreshId: string }> {
    const accessToken = await this.jwt.signAsync(
      { sub: claims.id, email: claims.email, type: claims.type, tier: claims.tier, typ: 'access' },
      { secret: this.secrets.accessSecret, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    const refresh = await this.issueRefresh(claims.id, familyId);
    return {
      tokens: {
        access_token: accessToken,
        refresh_token: refresh.token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
      },
      refreshId: refresh.id,
    };
  }

  private async issueRefresh(
    compteId: string,
    familyId: string,
  ): Promise<{ token: string; id: string }> {
    const id = randomUUID();
    const token = await this.jwt.signAsync(
      { sub: compteId, fid: familyId, typ: 'refresh' },
      { secret: this.secrets.refreshSecret, expiresIn: REFRESH_TOKEN_TTL_SECONDS, jwtid: id },
    );
    await this.db.insert(refreshToken).values({
      id,
      compte_id: compteId,
      family_id: familyId,
      token_hash: this.sha256(token),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });
    return { token, id };
  }

  private async verifyRefresh(token: string): Promise<RefreshJwtPayload> {
    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshJwtPayload>(token, {
        secret: this.secrets.refreshSecret,
      });
    } catch {
      throw new InvalidRefreshTokenError();
    }
    if (payload.typ !== 'refresh' || !payload.jti) {
      throw new InvalidRefreshTokenError();
    }
    return payload;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revoked_at: new Date() })
      .where(and(eq(refreshToken.family_id, familyId), isNull(refreshToken.revoked_at)));
  }

  private sha256(value: string): string {
    return sha256Hex(value);
  }

  private matches(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
