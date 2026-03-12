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
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import type { GoogleProfile } from '../strategies/google.strategy';
import { BaseAuthController } from './base-auth.controller';

@ApiTags('Auth')
@Controller('api/auth/google')
export class GoogleController extends BaseAuthController {
  constructor(
    private readonly googleService: GoogleService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate);
  }

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
    const ctx = { ip, userAgent: userAgent ?? null };
    const user = await this.googleService.findOrCreateUser(req.user);

    const gate = await this.checkTwoFactor(user, req, res);
    if (gate === 'pending') return res.redirect('/auth/two-factor');

    const tokens = await this.googleService.createSession(user.id, ctx);
    this.setTokenCookies(res, tokens, true, 'lax');
    res.redirect('/');
  }
}
