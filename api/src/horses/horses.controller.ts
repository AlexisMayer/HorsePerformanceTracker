import {
  type ChevalCréerDto,
  type ChevalModifierDto,
  type ChevalSortie,
  chevalCréerSchema,
  chevalModifierSchema,
} from '@hpt/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HorsesService } from './horses.service';

/**
 * Frontière HTTP du module `horses` (lot 2.1, Architecture §5). Routes orientées
 * ressource (`/horses`, `/horses/:id`), **toutes authentifiées** (`JwtAccessGuard`
 * de 1.1) et **scopées au compte courant** : l'`id` du propriétaire vient du
 * jeton d'accès (`@CurrentUser`), jamais de l'URL — on n'agit que sur ses
 * chevaux. Validation Zod à l'entrée (DTO de `@hpt/shared`), règles métier dans
 * le service, projections sans clé inattendue.
 *
 * Les `:id` malformés sont rejetés en **400** par `ParseUUIDPipe` (avant la
 * base) ; un `:id` valide mais étranger au compte renvoie **404** (service).
 */
@Controller('horses')
@UseGuards(JwtAccessGuard)
export class HorsesController {
  constructor(private readonly horses: HorsesService) {}

  /** Crée un cheval lié au compte courant (quota de tier enforcé par le service). */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(chevalCréerSchema)) dto: ChevalCréerDto,
  ): Promise<ChevalSortie> {
    return this.horses.create(user.id, user.tier, dto);
  }

  /** Liste les chevaux du compte courant. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ChevalSortie[]> {
    return this.horses.list(user.id);
  }

  /** Détail d'un cheval du compte (404 sinon). */
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChevalSortie> {
    return this.horses.findOne(user.id, id);
  }

  /** Édite un cheval du compte (PATCH partiel ; 404 sinon). */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(chevalModifierSchema)) dto: ChevalModifierDto,
  ): Promise<ChevalSortie> {
    return this.horses.update(user.id, id, dto);
  }

  /** Supprime un cheval du compte — purge cascade (404 sinon). 204 au succès. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.horses.remove(user.id, id);
  }

  /**
   * **Archive** un cheval du compte (lot 4.3, Spec §9.2) — lecture seule, hors
   * quota, réversible. Action dédiée (pas un champ du PATCH). **Non gatée par le
   * tier** : un cavalier gratuit peut archiver son unique cheval. 404 sinon.
   */
  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChevalSortie> {
    return this.horses.archive(user.id, id);
  }

  /**
   * **Désarchive** un cheval du compte (lot 4.3) — le ramène dans l'actif.
   * **Quota-gardé (garde 4.1)** : refusé (403) si cela dépasserait le plafond de
   * chevaux actifs du tier ; le `tier` du principal est passé au service. 404 sinon.
   * `200` (bascule d'état d'une ressource existante, pas une création).
   */
  @Post(':id/unarchive')
  @HttpCode(200)
  unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChevalSortie> {
    return this.horses.unarchive(user.id, user.tier, id);
  }
}
