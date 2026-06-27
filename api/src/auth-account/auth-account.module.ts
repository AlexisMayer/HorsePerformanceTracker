import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DomainExceptionFilter } from '../common/domain-exception.filter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/**
 * Module `auth-account` (Architecture §3, lots 1.1→1.3 ; ici : 1.1 auth).
 * `JwtModule.register({})` reste vide : les secrets/durées sont passés par
 * appel dans `TokenService` (access et refresh ont des secrets distincts). Le
 * `DomainExceptionFilter` traduit les erreurs de domaine en réponses HTTP.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAccessStrategy,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AuthAccountModule {}
