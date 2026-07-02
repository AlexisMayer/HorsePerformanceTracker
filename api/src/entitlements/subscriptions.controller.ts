import {
  type AbonnementStatutSortie,
  type CheckoutDemandeDto,
  type CheckoutSortie,
  checkoutDemandeSchema,
  type OffresSortie,
} from '@hpt/shared';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Frontière HTTP de l'**abonnement & upgrade in-app** (lot 4.2, Spec §9.3).
 * Authentifiée (`JwtAccessGuard` de 1.1) ; opère sur le **compte courant** (id +
 * e-mail du principal, jamais un id d'URL).
 *
 *  - `GET /me/subscription/offres` — tarifs (montants **lus de la config**) pour
 *    le paywall ;
 *  - `POST /me/subscription/checkout` — démarre le checkout Mollie d'une
 *    souscription **neuve** (n'élève pas le tier — autorité du webhook) ;
 *  - `POST /me/subscription/changer-formule` — **upgrade premium→pro** (MOD-001) :
 *    résilie le premium + crée le pro sur le **mandat réutilisé**, réservé aux
 *    comptes **déjà premium** ; le tier ne bascule qu'au webhook ;
 *  - `GET /me/subscription` — état d'abonnement (pour l'état *pending* /
 *    déverrouillé) + URL de gestion Mollie ;
 *  - `POST /me/subscription/annuler` — résiliation (gestion fine côté Mollie).
 */
@Controller('me/subscription')
@UseGuards(JwtAccessGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** Offres tarifaires (premium/pro), montants paramétrables lus de la config. */
  @Get('offres')
  offres(): OffresSortie {
    return this.subscriptions.listerOffres();
  }

  /** Démarre un checkout Mollie pour le tier choisi ; renvoie l'URL à ouvrir. */
  @Post('checkout')
  @HttpCode(200)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(checkoutDemandeSchema)) dto: CheckoutDemandeDto,
  ): Promise<CheckoutSortie> {
    return this.subscriptions.créerCheckout(user.id, user.email, dto.tier_cible);
  }

  /**
   * **Passer à Pro** (upgrade premium→pro, MOD-001, Spec §9.3) — changement de
   * formule *distinct* de la souscription neuve, réservé aux comptes **déjà
   * premium** (garde côté service sur le tier du principal). Aucun corps : la seule
   * cible d'upgrade est `pro`. Renvoie l'URL de checkout du **paiement pro sur le
   * mandat réutilisé** ; le tier ne bascule qu'au **webhook** (accès premium
   * conservé jusque-là).
   */
  @Post('changer-formule')
  @HttpCode(200)
  changerFormule(@CurrentUser() user: AuthenticatedUser): Promise<CheckoutSortie> {
    return this.subscriptions.changerFormule(user.id, user.tier);
  }

  /** État d'abonnement du compte courant + URL de gestion Mollie (renvoi). */
  @Get()
  statut(@CurrentUser() user: AuthenticatedUser): Promise<AbonnementStatutSortie> {
    return this.subscriptions.statut(user.id);
  }

  /** Résilie l'abonnement courant (renvoi vers l'espace Mollie en complément). */
  @Post('annuler')
  @HttpCode(200)
  annuler(@CurrentUser() user: AuthenticatedUser): Promise<AbonnementStatutSortie> {
    return this.subscriptions.annuler(user.id);
  }
}
