import { Controller, Get, Headers, Request, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import type { Request as ExpressRequest, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { GoogleService } from '../services/google.service';
import type { GoogleProfile } from '../strategies/google.strategy';
import type { TokenPair } from '../services/auth.service';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
} from '../auth.constants';

@ApiTags('Auth')
@Controller('api/auth/google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  initiate() {
    // Passport handles the redirect to Google
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('callback')
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async callback(
    @Request() req: ExpressRequest & { user: GoogleProfile },
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res() res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const { tokens } = await this.googleService.signIn(req.user, {
      ip,
      userAgent: userAgent ?? null,
    });

    this.setTokenCookies(res, tokens);
    res.redirect('/');
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const secure = process.env.NODE_ENV === 'production';

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_EXPIRES_MS,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_REMEMBER_ME_EXPIRES_MS,
    });
  }
}
