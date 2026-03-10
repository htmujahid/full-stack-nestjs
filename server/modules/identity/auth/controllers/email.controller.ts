import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { type TokenPair } from '../services/auth.service';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
} from '../auth.constants';
import { SignUpDto } from '../dto/sign-up.dto';
import { SignInDto } from '../dto/sign-in.dto';
import { SendVerificationEmailDto } from '../dto/send-verification-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Public } from '../decorators/public.decorator';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import type { User } from '../../user/user.entity';

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Public()
  @Post('sign-up/email')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
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
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
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
    const result = await this.emailService.signIn(req.user, rememberMe, {
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
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Send or resend verification email' })
  @ApiOkResponse({ description: 'Always returns ok; does not leak whether account exists' })
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
    const result = await this.emailService.verifyEmail(token, { ip, userAgent: userAgent ?? null });

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
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiOkResponse({ description: 'Always returns ok; does not leak whether account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.emailService.forgotPassword(dto.email, dto.callbackURL);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.emailService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  private setTokenCookies(res: Response, tokens: TokenPair, rememberMe: boolean): void {
    const secure = process.env.NODE_ENV === 'production';

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_EXPIRES_MS,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: rememberMe ? REFRESH_REMEMBER_ME_EXPIRES_MS : REFRESH_EXPIRES_MS,
    });
  }
}
