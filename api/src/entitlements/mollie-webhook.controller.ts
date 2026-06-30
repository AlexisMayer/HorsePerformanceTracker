import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FakeMollie } from './mollie/fake-mollie';
import { MOLLIE, type MolliePort, type StatutPaiementMollie } from './mollie/mollie.port';
import { SUBSCRIPTION_CONFIG, type SubscriptionConfig } from './subscription.config';
import { SubscriptionsService } from './subscriptions.service';

/**
 * **Webhook Mollie** (lot 4.2) — frontière **publique** (pas de `JwtAccessGuard` :
 * l'appelant est Mollie, pas un utilisateur). C'est le **point d'autorité** du
 * changement de tier (Stack §6) : Mollie poste l'**id de paiement**, on
 * **réconcilie** (le service lit l'état réel et élève le tier si honoré). Le
 * corps Mollie est `application/x-www-form-urlencoded` (`id=tr_…`) — parsé par
 * le body-parser par défaut de Nest. On répond **200** pour acquitter (un échec
 * transitoire laisse remonter une 5xx → Mollie réessaie).
 *
 * En **mode fake** (dev sans clé Mollie), une route **dev** rend le flux
 * cliquable de bout en bout (`GET …/dev/checkout/:id`) : elle simule le paiement
 * puis réconcilie, exactement comme le ferait le vrai webhook. Elle **n'existe
 * pas** en prod (404 si une vraie clé est configurée).
 */
@Controller('webhooks/mollie')
export class MollieWebhookController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    @Inject(MOLLIE) private readonly mollie: MolliePort,
    @Inject(SUBSCRIPTION_CONFIG) private readonly config: SubscriptionConfig,
  ) {}

  /** Webhook réel : Mollie poste l'id de paiement → réconciliation (autorité). */
  @Post()
  @HttpCode(200)
  async recevoir(@Body() body: { id?: unknown }): Promise<{ received: true }> {
    const paymentId = typeof body?.id === 'string' ? body.id : null;
    if (paymentId) {
      await this.subscriptions.réconcilier(paymentId);
    }
    // 200 même sans id : on acquitte pour ne pas déclencher de réessais inutiles.
    return { received: true };
  }

  /**
   * **Dev only** (mode fake) : page de checkout simulée (l'URL renvoyée par le
   * `FakeMollie`). La visiter **simule** le paiement (`statut`, défaut `paid`)
   * puis **réconcilie** comme le webhook, et redirige vers l'app. Rend les
   * webhooks **simulables localement** (Stack §6) sans Mollie réel.
   */
  @Get('dev/checkout/:paymentId')
  async simulerCheckoutDev(
    @Param('paymentId') paymentId: string,
    @Query('statut') statut: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const fake = this.exigerFake();
    fake.simulerPaiement(paymentId, this.statutValide(statut));
    await this.subscriptions.réconcilier(paymentId);
    // Redirige vers le deep link de retour de l'app (au retour : re-lecture entitlement).
    res.redirect(this.config.redirectUrl);
  }

  /** Garde le mode fake : en prod (vraie clé Mollie), la route dev n'existe pas. */
  private exigerFake(): FakeMollie {
    if (this.config.mollieApiKey !== null || !(this.mollie instanceof FakeMollie)) {
      throw new NotFoundException();
    }
    return this.mollie;
  }

  private statutValide(statut: string | undefined): StatutPaiementMollie {
    const connus: StatutPaiementMollie[] = [
      'open',
      'pending',
      'authorized',
      'paid',
      'failed',
      'canceled',
      'expired',
    ];
    return connus.find((s) => s === statut) ?? 'paid';
  }
}
