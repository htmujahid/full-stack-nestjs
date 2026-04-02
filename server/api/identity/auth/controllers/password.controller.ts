import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Redirect,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { PasswordService } from '../services/password.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from '../auth.constants';
import { BaseAuthController } from './base-auth.controller';
import { SignInDto } from '../dto/sign-in.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Public } from '../decorators/public.decorator';
import { PasswordAuthGuard } from '../guards/password-auth.guard';
import { JwtFreshGuard } from '../guards/jwt-fresh.guard';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import type { User } from '../../user/user.entity';

@ApiTags('Auth')
// Route prefix: /api/auth (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(ThrottlerGuard)
export class PasswordController extends BaseAuthController {
  constructor(
    private readonly passwordService: PasswordService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate);
  }

  @Public()
  @Post('sign-up/password')
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Sign up with email and password' })
  @ApiOkResponse({ description: 'User created; verification email sent' })
  async signUp(@Body() dto: SignUpDto) {
    const result = await this.passwordService.signUp(dto);
    return { user: result.user };
  }

  @Public()
  @UseGuards(PasswordAuthGuard)
  @Post('sign-in/password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({
    summary: 'Sign in with identifier (email/username/phone) and password',
  })
  @ApiOkResponse({ description: 'Sets access and refresh token cookies' })
  async signIn(
    @Request() req: ExpressRequest & { user: User },
    @Body() dto: SignInDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const rememberMe = dto?.rememberMe !== false;
    const user = req.user;

    const gate = await this.checkTwoFactor(user, req, res);
    if (gate === 'pending') return { twoFactorRedirect: true };

    const result = await this.passwordService.signIn(user, rememberMe, {
      ip,
      userAgent: userAgent ?? null,
    });
    this.setTokenCookies(res, result.tokens, rememberMe);

    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiOkResponse({
    description: 'Always returns ok; does not leak whether account exists',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordService.forgotPassword(
      dto.email,
      dto.callbackURL,
      dto.errorURL,
    );
    return { ok: true };
  }

  @Public()
  @Get('reset-password/:token')
  @Redirect('/')
  @ApiOperation({
    summary: 'Validate reset token and redirect to frontend with token',
  })
  async resetPasswordCallback(
    @Param('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Query('errorURL') errorURL: string | undefined,
  ) {
    const isValid =
      await this.passwordService.validateResetPasswordToken(token);
    const successSeparator = callbackURL?.includes('?') ? '&' : '?';
    const errorTarget = errorURL ?? '/auth/error';
    const errorSeparator = errorTarget.includes('?') ? '&' : '?';

    if (!isValid || !callbackURL) {
      const url = errorTarget + `${errorSeparator}error=INVALID_TOKEN`;
      return { url, statusCode: HttpStatus.FOUND };
    }

    return {
      url: `${callbackURL}${successSeparator}token=${token}`,
      statusCode: HttpStatus.FOUND,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtFreshGuard)
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update password (requires recent re-authentication)',
  })
  @ApiOkResponse({
    description: 'Password updated; all other sessions invalidated',
  })
  async updatePassword(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: UpdatePasswordDto,
  ) {
    await this.passwordService.updatePassword(req.user.userId, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtFreshGuard)
  @Post('add-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({
    summary: 'Add password account (requires recent re-authentication)',
  })
  @ApiOkResponse({
    description:
      'Password account added; user can now sign in with email and password',
  })
  async addPassword(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: UpdatePasswordDto,
  ) {
    await this.passwordService.addPassword(req.user.userId, dto.newPassword);
    return { ok: true };
  }
}
