import {
  type AuthTokens,
  type CompteSortie,
  type LoginDto,
  type LogoutDto,
  loginSchema,
  logoutSchema,
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

/**
 * Frontière HTTP de l'auth (Architecture §5) : validation Zod à l'entrée (DTO
 * de `@hpt/shared`), délégation au service de domaine, projections sans secret.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
}
