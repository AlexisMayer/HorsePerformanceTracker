import {
  type AuthTokens,
  type CompteSortie,
  type EmailVerificationConfirmDto,
  type EmailVerificationRequestDto,
  emailVerificationConfirmSchema,
  emailVerificationRequestSchema,
  type LoginDto,
  type LogoutDto,
  loginSchema,
  logoutSchema,
  type PasswordResetConfirmDto,
  type PasswordResetRequestDto,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type RefreshDto,
  type RegisterDto,
  refreshSchema,
  registerSchema,
} from '@hpt/shared';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { type AuthenticatedUser, CurrentUser } from './current-user.decorator';
import { JwtAccessGuard } from './jwt-access.guard';
import { VerificationService } from './verification.service';

/**
 * Frontière HTTP de l'auth (Architecture §5) : validation Zod à l'entrée (DTO
 * de `@hpt/shared`), délégation au service de domaine, projections sans secret.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly verification: VerificationService,
  ) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto): Promise<CompteSortie> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto): Promise<AuthTokens> {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body(new ZodValidationPipe(logoutSchema)) dto: LogoutDto): Promise<void> {
    return this.auth.logout(dto.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<CompteSortie> {
    return this.auth.currentAccount(user.id);
  }

  /**
   * Confirme la vérification d'e-mail : jeton valide → `email_verified = true`.
   * Renvoie le compte mis à jour (la vérification est observable).
   */
  @Post('verify-email/confirm')
  @HttpCode(200)
  confirmEmailVerification(
    @Body(new ZodValidationPipe(emailVerificationConfirmSchema)) dto: EmailVerificationConfirmDto,
  ): Promise<CompteSortie> {
    return this.verification.confirmEmailVerification(dto.token);
  }

  /**
   * (Re)demande le lien de vérification d'e-mail. **Anti-énumération** : 200
   * systématique, corps vide — n'indique jamais si le compte existe.
   */
  @Post('verify-email/request')
  @HttpCode(200)
  requestEmailVerification(
    @Body(new ZodValidationPipe(emailVerificationRequestSchema)) dto: EmailVerificationRequestDto,
  ): Promise<void> {
    return this.verification.requestEmailVerification(dto.email);
  }

  /**
   * Demande de réinitialisation de mot de passe. **Anti-énumération** : 200
   * systématique, corps vide — le lien n'est envoyé que si le compte existe.
   */
  @Post('password-reset/request')
  @HttpCode(200)
  requestPasswordReset(
    @Body(new ZodValidationPipe(passwordResetRequestSchema)) dto: PasswordResetRequestDto,
  ): Promise<void> {
    return this.verification.requestPasswordReset(dto.email);
  }

  /**
   * Confirme la réinitialisation : jeton + nouveau mot de passe → re-hash argon2
   * et révocation de tous les refresh tokens du compte. 204 (sans contenu).
   */
  @Post('password-reset/confirm')
  @HttpCode(204)
  confirmPasswordReset(
    @Body(new ZodValidationPipe(passwordResetConfirmSchema)) dto: PasswordResetConfirmDto,
  ): Promise<void> {
    return this.verification.confirmPasswordReset(dto.token, dto.new_password);
  }
}
