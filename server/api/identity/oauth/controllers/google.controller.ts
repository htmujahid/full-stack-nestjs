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
import { AccountService } from '../../account/account.service';
import { AuthService } from '../../auth/services/auth.service';
import { TwoFactorGateService } from '../../auth/services/two-factor-gate.service';
import { UserService } from '../../user/user.service';
import type { GoogleProfile } from '../strategies/google.strategy';
import { BaseOAuthController } from './base-oauth.controller';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Auth')
// Route prefix: /api/oauth/google (managed by RouterModule — see server/routes.ts)
@Controller()
export class GoogleController extends BaseOAuthController {
  constructor(
    twoFactorGate: TwoFactorGateService,
    accountService: AccountService,
    jwtService: JwtService,
    userService: UserService,
    authService: AuthService,
  ) {
    super(twoFactorGate, accountService, jwtService, userService, authService);
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
  @Redirect()
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async callback(
    @Request() req: ExpressRequest & { user: GoogleProfile },
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const ctx = { ip, userAgent: userAgent ?? null };
    const user = await this.userService.findOrCreateUser(req.user);
    return this.handleOAuthSignIn(req, res, user, () =>
      this.authService.createAuthSession(
        user.id,
        user.role,
        true,
        ctx,
        'google',
      ),
    );
  }
}
