import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DomainExceptionFilter } from '../common/domain-exception.filter';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { ConsoleMailer } from './mailer/console-mailer';
import { MAILER } from './mailer/mailer';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

/**
 * Module `auth-account` (Architecture §3, lots 1.1→1.3 ; ici : 1.1 auth + 1.2
 * vérification e-mail / reset + 1.3 RGPD compte — suppression / export).
 * `JwtModule.register({})` reste vide : les
 * secrets/durées sont passés par appel dans `TokenService` (access et refresh
 * ont des secrets distincts). Le `DomainExceptionFilter` traduit les erreurs de
 * domaine en réponses HTTP.
 *
 * Le port `Mailer` est lié à `ConsoleMailer` (stub dev). En prod, on permute
 * ici l'implémentation Scaleway TEM (Stack §3.5, différée) sans toucher au
 * domaine.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    AccountService,
    PasswordService,
    TokenService,
    VerificationService,
    JwtAccessStrategy,
    { provide: MAILER, useClass: ConsoleMailer },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AuthAccountModule {}
