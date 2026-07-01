import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AI_BILAN_CONFIG, type AiBilanConfig, loadAiBilanConfig } from './ai-bilan.config';
import { AiBilanController } from './ai-bilan.controller';
import { AiBilanService } from './ai-bilan.service';
import { AiBilanRateLimiter } from './ai-bilan-rate-limiter';
import { MISTRAL, type MistralPort } from './mistral.port';
import { MistralHttpClient } from './mistral-http.client';
import { StubMistral } from './stub-mistral';

/**
 * Module `ai-bilan` (lot 4.5, Architecture §3 : **bilan augmenté (Mistral),
 * persisté** — dépend de `sessions`). Il **compose** via le service exposé
 * (jamais ses tables, §1/§3) et possède **sa** table `bilan_augmente` :
 *
 *  - `SessionsModule` → `SessionsService` (séance + historique, propriété/404) ;
 *  - `EntitlementsModule` → `EntitlementGuard` (garde `bilan_augmenté`, 4.1) ;
 *  - `PassportModule` → stratégie `jwt-access` de la garde d'auth ;
 *  - `DatabaseModule` est `@Global` (jeton `DRIZZLE`) → la persistance sans import.
 *
 * **Client IA derrière une interface injectable** (Stack §3.6, consigne) : le
 * jeton `MISTRAL` est fourni par `useFactory` — le **stub déterministe**
 * (`StubMistral`) **sans clé** (dev/test : le sandbox n'atteint pas Mistral) ; le
 * **vrai client** (`MistralHttpClient`, La Plateforme UE) **avec clé**
 * (`MISTRAL_API_KEY`, Secret Manager en prod). Les tests **moquent** ce port.
 *
 * **Rate limiting** (`AiBilanRateLimiter`) et **modèle épinglé** viennent de
 * `AI_BILAN_CONFIG` (paramétrable par env, jamais en dur).
 */
@Module({
  imports: [PassportModule, EntitlementsModule, SessionsModule],
  controllers: [AiBilanController],
  providers: [
    AiBilanService,
    { provide: AI_BILAN_CONFIG, useFactory: loadAiBilanConfig },
    // Rate limiter construit via factory (horloge par défaut = Date.now) — son
    // second paramètre n'est donc pas résolu par le conteneur.
    {
      provide: AiBilanRateLimiter,
      useFactory: (config: AiBilanConfig) => new AiBilanRateLimiter(config),
      inject: [AI_BILAN_CONFIG],
    },
    // Port IA : stub déterministe sans clé (dev/test) ; vrai client avec clé (prod).
    {
      provide: MISTRAL,
      useFactory: (config: AiBilanConfig): MistralPort =>
        config.apiKey
          ? new MistralHttpClient({ ...config, apiKey: config.apiKey })
          : new StubMistral(config),
      inject: [AI_BILAN_CONFIG],
    },
  ],
})
export class AiBilanModule {}
