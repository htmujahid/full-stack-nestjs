import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService, type TokenPair } from '../services/auth.service';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
} from '../auth.constants';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';

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
