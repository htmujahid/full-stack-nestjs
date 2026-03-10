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
import { AuthService, type TokenPair } from './auth.service';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
} from './auth.constants';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SendVerificationEmailDto } from './dto/send-verification-email.dto';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { User } from '../user/user.entity';

interface RefreshUser {
  userId: string;
  sessionId: string;
  familyId: string;
  rawRefreshToken: string;
}

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('sign-up/email')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Sign up with email and password' })
  @ApiOkResponse({ description: 'User created; verification email sent' })
  async signUp(@Body() dto: SignUpDto) {
    const result = await this.authService.signUp(dto);
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
    const result = await this.authService.signIn(req.user, rememberMe, {
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
    await this.authService.resendVerificationEmail(dto.email, dto.callbackURL);
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
    const result = await this.authService.verifyEmail(token, { ip, userAgent: userAgent ?? null });

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

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access and refresh tokens' })
  @ApiOkResponse({ description: 'Issues a new token pair' })
  async refresh(
    @Request() req: ExpressRequest & { user: RefreshUser },
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const { userId, sessionId, familyId, rawRefreshToken } = req.user;
    const tokens = await this.authService.refreshTokens(userId, sessionId, familyId, rawRefreshToken, {
      ip,
      userAgent: userAgent ?? null,
    });
    this.setTokenCookies(res, tokens, false);
    return { ok: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out and revoke current refresh session' })
  async signOut(
    @Request() req: ExpressRequest & { user: RefreshUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.signOut(req.user.userId, req.user.sessionId);
    res.clearCookie(ACCESS_TOKEN_COOKIE);
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
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
