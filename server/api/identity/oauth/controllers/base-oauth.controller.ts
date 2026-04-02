import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request as ExpressRequest, Response } from 'express';
import { AccountService } from '../../account/account.service';
import { TwoFactorGateService } from '../../auth/services/two-factor-gate.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserService } from '../../user/user.service';
import {
  ACCESS_TOKEN_COOKIE,
  OAUTH_REDIRECT_COOKIE,
} from '../../auth/auth.constants';
import { BaseAuthController } from '../../auth/controllers/base-auth.controller';
import type { OAuthAccount, TokenPair } from 'api/identity/auth/types';
import type { User } from 'api/identity/user/user.entity';

export abstract class BaseOAuthController extends BaseAuthController {
  constructor(
    twoFactorGate: TwoFactorGateService,
    protected readonly accountService: AccountService,
    protected readonly jwtService: JwtService,
    protected readonly userService: UserService,
    protected readonly authService: AuthService,
  ) {
    super(twoFactorGate);
  }

  protected async handleOAuthLink(
    req: ExpressRequest,
    res: Response,
    account: OAuthAccount,
  ) {
    const cookies = req.cookies as Record<string, string>;
    const redirectBase =
      cookies?.[OAUTH_REDIRECT_COOKIE] ?? '/account/security';
    res.clearCookie(OAUTH_REDIRECT_COOKIE, { path: '/' });

    const accessToken = cookies?.[ACCESS_TOKEN_COOKIE];
    if (!accessToken) {
      return {
        url: `${redirectBase}?error=not_authenticated`,
        statusCode: HttpStatus.FOUND,
      };
    }

    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(accessToken);
      userId = payload.sub;
    } catch {
      return {
        url: `${redirectBase}?error=session_expired`,
        statusCode: HttpStatus.FOUND,
      };
    }

    try {
      await this.accountService.linkAccount(userId, account);
      return {
        url: `${redirectBase}?linked=${account.providerId}`,
        statusCode: HttpStatus.FOUND,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? encodeURIComponent(err.message) : 'link_failed';
      return {
        url: `${redirectBase}?error=${message}`,
        statusCode: HttpStatus.FOUND,
      };
    }
  }

  /**
   * createTokens is called lazily — only after the 2FA gate passes,
   * so no session is created for users who still need to complete 2FA.
   */
  protected async handleOAuthSignIn(
    req: ExpressRequest,
    res: Response,
    user: User,
    createTokens: () => Promise<TokenPair>,
  ) {
    const cookies = req.cookies as Record<string, string>;
    const redirectUri = cookies?.[OAUTH_REDIRECT_COOKIE] ?? '/';
    res.clearCookie(OAUTH_REDIRECT_COOKIE, { path: '/' });

    const gate = await this.checkTwoFactor(user, req, res);
    if (gate === 'pending')
      return { url: '/auth/two-factor', statusCode: HttpStatus.FOUND };

    const tokens = await createTokens();
    this.setTokenCookies(res, tokens, true, 'lax');
    return { url: redirectUri, statusCode: HttpStatus.FOUND };
  }
}
