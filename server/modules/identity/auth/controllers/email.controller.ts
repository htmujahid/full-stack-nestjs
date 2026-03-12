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
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { EmailService } from '../services/email.service';
import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  TRUST_DEVICE_COOKIE,
} from '../auth.constants';
import { BaseAuthController } from './base-auth.controller';
import { SignUpDto } from '../dto/sign-up.dto';
import { SignInDto } from '../dto/sign-in.dto';
import { SendVerificationEmailDto } from '../dto/send-verification-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Public } from '../decorators/public.decorator';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtFreshGuard } from '../guards/jwt-fresh.guard';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import { UpdateEmailDto } from '../dto/update-email.dto';
import type { User } from '../../user/user.entity';

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class EmailController extends BaseAuthController {
  constructor(private readonly emailService: EmailService) {
    super();
  }

  @Public()
  @Post('sign-up/email')
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Sign up with email and password' })
  @ApiOkResponse({ description: 'User created; verification email sent' })
  async signUp(@Body() dto: SignUpDto) {
    const result = await this.emailService.signUp(dto);
    return { user: result.user };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('sign-in/email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ description: 'Sets access and refresh token cookies' })
  async signIn(
    @Request() req: ExpressRequest & { user: User },
    @Body() dto: SignInDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const rememberMe = dto.rememberMe !== false;
    const user = req.user;

    if (user.twoFactorEnabled) {
      const trustCookieValue = (req.cookies as Record<string, string>)?.[
        TRUST_DEVICE_COOKIE
      ];
      const isTrusted = trustCookieValue
        ? await this.emailService.checkTrustDevice(trustCookieValue, user.id)
        : false;

      if (!isTrusted) {
        const pendingToken = await this.emailService.createPendingToken(
          user.id,
        );
        this.setPendingCookie(res, pendingToken);
        return { twoFactorRedirect: true };
      }

      // Trusted device: rotate trust cookie and proceed to full sign-in
      const newTrustValue = await this.emailService.rotateTrustDevice(
        trustCookieValue,
        user.id,
      );
      this.setTrustDeviceCookie(res, newTrustValue);
    }

    const result = await this.emailService.signIn(user, rememberMe, {
      ip,
      userAgent: userAgent ?? null,
    });
    this.setTokenCookies(res, result.tokens, rememberMe);
    return {
      url: dto.callbackURL ?? null,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    };
  }

  @Public()
  @Post('send-verification-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Send or resend verification email' })
  @ApiOkResponse({
    description: 'Always returns ok; does not leak whether account exists',
  })
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto) {
    await this.emailService.resendVerificationEmail(dto.email, dto.callbackURL);
    return { ok: true };
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email via token from link' })
  async verifyEmail(
    @Query('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const result = await this.emailService.verifyEmail(token, {
      ip,
      userAgent: userAgent ?? null,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, url: callbackURL ?? null };
    }

    this.setTokenCookies(res, result.tokens, false);
    return {
      ok: true,
      url: callbackURL ?? null,
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
    await this.emailService.forgotPassword(dto.email, dto.callbackURL);
    return { ok: true };
  }

  @Public()
  @Get('reset-password/:token')
  @ApiOperation({
    summary: 'Validate reset token and redirect to frontend with token',
  })
  async resetPasswordCallback(
    @Param('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Res() res: Response,
  ) {
    const isValid = await this.emailService.validateResetPasswordToken(token);
    const separator = callbackURL?.includes('?') ? '&' : '?';

    if (!isValid || !callbackURL) {
      const errorURL = callbackURL
        ? `${callbackURL}${separator}error=INVALID_TOKEN`
        : '/';
      return res.redirect(errorURL);
    }

    return res.redirect(`${callbackURL}${separator}token=${token}`);
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
    await this.emailService.resetPassword(dto.token, dto.newPassword);
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
    await this.emailService.updatePassword(req.user.userId, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtFreshGuard)
  @Patch('email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({
    summary: 'Request email change (requires recent re-authentication)',
  })
  @ApiOkResponse({ description: 'Verification email sent to new address' })
  async updateEmail(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: UpdateEmailDto,
  ) {
    await this.emailService.initiateEmailChange(req.user.userId, dto.newEmail);
    return { ok: true };
  }

  @Public()
  @Get('verify-email-change')
  @ApiOperation({ summary: 'Confirm email change via token from link' })
  async verifyEmailChange(@Query('token') token: string) {
    const result = await this.emailService.verifyEmailChange(token);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }
}
