import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EntitlementGuard } from './entitlement.guard';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { FakeMollie } from './mollie/fake-mollie';
import { MOLLIE, type MolliePort } from './mollie/mollie.port';
import { MollieHttpClient } from './mollie/mollie-http.client';
import { MollieWebhookController } from './mollie-webhook.controller';
import {
  loadSubscriptionConfig,
  SUBSCRIPTION_CONFIG,
  type SubscriptionConfig,
} from './subscription.config';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Module `entitlements` (Architecture §3 : **Tiers, Mollie, garde de gating** —
 * dépend de `auth-account` pour l'identité/le tier du principal).
 *
 * **Lot 4.1** : `EntitlementsService` (politique/garde) + `EntitlementGuard` —
 * exportés (consommés par `horses`/`combinations` pour les quotas, et par les
 * fonctions payantes 4.4+ pour la garde de capacité).
 *
 * **Lot 4.2** (extension) : l'**abonnement & upgrade in-app** (Mollie).
 *  - `SUBSCRIPTION_CONFIG` — config (montants paramétrables, clés, URLs) résolue
 *    de l'env au démarrage ;
 *  - `MOLLIE` — port PSP : `FakeMollie` (dev sans clé / tests, webhooks
 *    simulables) **ou** `MollieHttpClient` (mode test/prod si `MOLLIE_API_KEY`) ;
 *  - `SubscriptionsService` + `SubscriptionsController` (`/me/subscription/*`) +
 *    `MollieWebhookController` (`/webhooks/mollie`, **autorité du tier**).
 *
 * `DatabaseModule` est `@Global` (jeton `DRIZZLE`) → l'abonnement persiste sans
 * import explicite. Le `DomainExceptionFilter` global (1.1) traduit les erreurs.
 */
@Module({
  imports: [PassportModule],
  controllers: [EntitlementsController, SubscriptionsController, MollieWebhookController],
  providers: [
    EntitlementsService,
    EntitlementGuard,
    SubscriptionsService,
    { provide: SUBSCRIPTION_CONFIG, useFactory: loadSubscriptionConfig },
    {
      provide: MOLLIE,
      useFactory: (config: SubscriptionConfig): MolliePort =>
        config.mollieApiKey ? new MollieHttpClient(config.mollieApiKey) : new FakeMollie(),
      inject: [SUBSCRIPTION_CONFIG],
    },
  ],
  exports: [EntitlementsService, EntitlementGuard],
})
export class EntitlementsModule {}
