import {
  type CombinaisonCréerDto,
  type CombinaisonModifierDto,
  type CombinaisonSortie,
  combinaisonCréerSchema,
  combinaisonModifierSchema,
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
import { CombinationsService } from './combinations.service';

/**
 * Frontière HTTP du module `combinations` (lot 2.5, Architecture §5). Route
 * ressource `/combinations`, **toutes authentifiées** (`JwtAccessGuard` de 1.1)
 * et **scopées au compte courant** : l'`id` du propriétaire vient du jeton
 * (`@CurrentUser`), jamais du corps — la bibliothèque est au **niveau du compte**
 * (Modèle §8). Validation Zod à l'entrée (DTO de `@hpt/shared`), règles métier au
 * service, projections sans clé inattendue.
 *
 * **Sémantique exposée** : `PATCH` **ne mute pas** la réutilisable — il **crée
 * une nouvelle** (modification = nouvelle, Modèle §8/Spec §4.3) et renvoie la
 * **nouvelle** ; l'ancienne reste intacte (identité stable). Aucun plafond de
 * bibliothèque ici (gating = lot 4.1).
 *
 * Les `:id` malformés sont rejetés en **400** par `ParseUUIDPipe` (avant la base) ;
 * un `:id` valide mais étranger au compte renvoie **404** (service).
 */
@Controller('combinations')
@UseGuards(JwtAccessGuard)
export class CombinationsController {
  constructor(private readonly combinations: CombinationsService) {}

  /** Crée une réutilisable du compte courant (nom auto si absent ; plafond enforcé). */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(combinaisonCréerSchema)) dto: CombinaisonCréerDto,
  ): Promise<CombinaisonSortie> {
    return this.combinations.create(user.id, user.tier, dto);
  }

  /** Liste la bibliothèque du compte courant, **triée par usage** (anti-bloat). */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CombinaisonSortie[]> {
    return this.combinations.list(user.id);
  }

  /**
   * « Édite » une réutilisable = en **crée une nouvelle** (l'ancienne intacte) et
   * renvoie la **nouvelle** (modification = nouvelle). 404 si étrangère au compte ;
   * 400 si la structure dérivée est incohérente.
   */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(combinaisonModifierSchema)) dto: CombinaisonModifierDto,
  ): Promise<CombinaisonSortie> {
    return this.combinations.update(user.id, user.tier, id, dto);
  }

  /** Supprime une réutilisable du compte ; les obstacles liés passent en SET NULL. */
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.combinations.remove(user.id, id);
  }
}
