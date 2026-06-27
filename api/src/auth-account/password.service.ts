import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from './auth.config';

/**
 * Hachage des mots de passe en **argon2id** (Stack §3.4). Le hash encode ses
 * propres paramètres : la vérification n'a pas besoin de les repréciser.
 */
@Injectable()
export class PasswordService {
  private dummyHash?: string;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  /**
   * Vérifie `plain` contre `hash`. Si `hash` est absent (e-mail inconnu au
   * login), on compare quand même à un hash factice de mêmes paramètres puis on
   * renvoie `false` : le coût reste constant → pas d'oracle de timing révélant
   * l'existence d'un compte.
   */
  async verify(hash: string | null | undefined, plain: string): Promise<boolean> {
    if (!hash) {
      await argon2.verify(await this.getDummyHash(), plain).catch(() => false);
      return false;
    }
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await this.hash(randomUUID());
    }
    return this.dummyHash;
  }
}
