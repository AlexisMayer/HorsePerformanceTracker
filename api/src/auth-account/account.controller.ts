import { type AccountDeleteDto, type AccountExport, accountDeleteSchema } from '@hpt/shared';
import { Body, Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountService } from './account.service';
import { type AuthenticatedUser, CurrentUser } from './current-user.decorator';
import { JwtAccessGuard } from './jwt-access.guard';

/**
 * Frontière HTTP des **droits RGPD du compte** (lot 1.3, Architecture §3/§5).
 * Les deux routes sont **authentifiées** (`JwtAccessGuard`) et opèrent sur le
 * **compte courant** (jamais un id de l'URL : on ne supprime/exporte que soi).
 */
@Controller('account')
@UseGuards(JwtAccessGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /**
   * Suppression de compte (droit à l'effacement) — purge dure en cascade.
   * Authentifiée **+ confirmation par mot de passe** (re-vérification de
   * l'identité, décision tranchée lot 1.3). 204 (sans contenu) au succès.
   */
  @Delete()
  @HttpCode(204)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(accountDeleteSchema)) dto: AccountDeleteDto,
  ): Promise<void> {
    return this.account.deleteAccount(user.id, dto.password);
  }

  /**
   * Export complet des données de l'utilisateur (droit à la portabilité) — JSON
   * structuré, sans secret (cf. `AccountService.exportAccount`).
   */
  @Get('export')
  export(@CurrentUser() user: AuthenticatedUser): Promise<AccountExport> {
    return this.account.exportAccount(user.id);
  }
}
