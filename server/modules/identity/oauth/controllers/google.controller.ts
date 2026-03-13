import {
  Controller,
  Get,
  Headers,
  Redirect,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import type { Request as ExpressRequest, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { GoogleService } from '../services/google.service';
import { AccountService } from '../../account/account.service';
import { TwoFactorGateService } from '../../auth/services/two-factor-gate.service';
import type { GoogleProfile } from '../strategies/google.strategy';
import { BaseOAuthController } from './base-oauth.controller';
import { LINK_INTENT_COOKIE } from '../../auth/auth.constants';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Auth')
@Controller('api/oauth/google')
export class GoogleController extends BaseOAuthController {
  constructor(
    private readonly googleService: GoogleService,
    accountService: AccountService,
    jwtService: JwtService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate, accountService, jwtService);
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
  @Redirect()
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async callback(
    @Request() req: ExpressRequest & { user: GoogleProfile },
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string>;

    if (cookies?.[LINK_INTENT_COOKIE]) {
      res.clearCookie(LINK_INTENT_COOKIE, { path: '/' });
      return this.handleOAuthLink(req, res, req.user);
    }

    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const ctx = { ip, userAgent: userAgent ?? null };
    const user = await this.googleService.findOrCreateUser(req.user);
    return this.handleOAuthSignIn(req, res, user, () =>
      this.googleService.createSession(user.id, user.role, ctx),
    );
  }
}
