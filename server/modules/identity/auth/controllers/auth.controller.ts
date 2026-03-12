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
import { AuthService } from '../services/auth.service';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth.constants';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { BaseAuthController } from './base-auth.controller';

interface RefreshUser {
  userId: string;
  sessionId: string;
  familyId: string;
  rawRefreshToken: string;
}

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController extends BaseAuthController {
  constructor(private readonly authService: AuthService) {
    super();
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
    const tokens = await this.authService.refreshTokens(
      userId,
      sessionId,
      familyId,
      rawRefreshToken,
      {
        ip,
        userAgent: userAgent ?? null,
      },
    );
    this.setTokenCookies(res, tokens, false);
    return {
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
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
}
