import {
  Controller,
  Get,
  Headers,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import type { Request as ExpressRequest, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { GoogleService } from '../services/google.service';
import { AccountService } from '../../account/account.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import type { GoogleProfile } from '../strategies/google.strategy';
import { BaseAuthController } from './base-auth.controller';
import { ACCESS_TOKEN_COOKIE, LINK_INTENT_COOKIE } from '../auth.constants';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Auth')
@Controller('api/auth/google')
export class GoogleController extends BaseAuthController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly accountService: AccountService,
    private readonly jwtService: JwtService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate);
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Initiate Google OAuth2 login or account link' })
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
    const cookies = req.cookies as Record<string, string>;
    const linkIntent = cookies?.[LINK_INTENT_COOKIE];

    if (linkIntent) {
      res.clearCookie(LINK_INTENT_COOKIE, { path: '/' });
      return this.handleLinkCallback(req, res);
    }

    return this.handleSignInCallback(req, res, forwardedFor, userAgent);
  }

  private async handleLinkCallback(
    req: ExpressRequest & { user: GoogleProfile },
    res: Response,
  ) {
    const cookies = req.cookies as Record<string, string>;
    const accessToken = cookies?.[ACCESS_TOKEN_COOKIE];

    if (!accessToken) {
      return res.redirect('/settings/accounts?error=not_authenticated');
    }

    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(accessToken);
      userId = payload.sub;
    } catch {
      return res.redirect('/settings/accounts?error=session_expired');
    }

    try {
      await this.accountService.linkAccount(userId, {
        providerId: req.user.providerId,
        accountId: req.user.accountId,
        accessToken: req.user.accessToken,
        refreshToken: req.user.refreshToken,
      });
      res.redirect('/settings/accounts?linked=google');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? encodeURIComponent(err.message) : 'link_failed';
      res.redirect(`/settings/accounts?error=${message}`);
    }
  }

  private async handleSignInCallback(
    req: ExpressRequest & { user: GoogleProfile },
    res: Response,
    forwardedFor: string | undefined,
    userAgent: string | undefined,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const ctx = { ip, userAgent: userAgent ?? null };
    const user = await this.googleService.findOrCreateUser(req.user);

    const gate = await this.checkTwoFactor(user, req, res);
    if (gate === 'pending') return res.redirect('/auth/two-factor');

    const tokens = await this.googleService.createSession(user.id, ctx);
    this.setTokenCookies(res, tokens, true, 'lax');
    res.redirect('/');
  }
}
