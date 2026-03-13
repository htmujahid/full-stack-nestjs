import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request as ExpressRequest, Response } from 'express';
import { AccountService } from '../../account/account.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import type { TokenPair } from '../services/auth.service';
import { UserRole } from '../../user/user-role.enum';
import {
  ACCESS_TOKEN_COOKIE,
  OAUTH_REDIRECT_COOKIE,
} from '../auth.constants';
import { BaseAuthController } from './base-auth.controller';

type OAuthAccount = {
  providerId: string;
  accountId: string;
  accessToken: string;
  refreshToken: string | null;
};

type OAuthUser = { id: string; role: UserRole; twoFactorEnabled: boolean };

type RedirectResult = { url: string; statusCode: number };

export abstract class BaseOAuthController extends BaseAuthController {
  constructor(
    twoFactorGate: TwoFactorGateService,
    protected readonly accountService: AccountService,
    protected readonly jwtService: JwtService,
  ) {
    super(twoFactorGate);
  }

  protected async handleOAuthLink(
    req: ExpressRequest,
    res: Response,
    account: OAuthAccount,
  ): Promise<RedirectResult> {
    const cookies = req.cookies as Record<string, string>;
    const redirectBase = cookies?.[OAUTH_REDIRECT_COOKIE] ?? '/settings/accounts';
    res.clearCookie(OAUTH_REDIRECT_COOKIE, { path: '/' });

    const accessToken = cookies?.[ACCESS_TOKEN_COOKIE];
    if (!accessToken) {
      return { url: `${redirectBase}?error=not_authenticated`, statusCode: HttpStatus.FOUND };
    }

    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(accessToken);
      userId = payload.sub;
    } catch {
      return { url: `${redirectBase}?error=session_expired`, statusCode: HttpStatus.FOUND };
    }

    try {
      await this.accountService.linkAccount(userId, account);
      return { url: `${redirectBase}?linked=${account.providerId}`, statusCode: HttpStatus.FOUND };
    } catch (err: unknown) {
      const message = err instanceof Error ? encodeURIComponent(err.message) : 'link_failed';
      return { url: `${redirectBase}?error=${message}`, statusCode: HttpStatus.FOUND };
    }
  }

  /**
   * createTokens is called lazily — only after the 2FA gate passes,
   * so no session is created for users who still need to complete 2FA.
   */
  protected async handleOAuthSignIn(
    req: ExpressRequest,
    res: Response,
    user: OAuthUser,
    createTokens: () => Promise<TokenPair>,
  ): Promise<RedirectResult> {
    const cookies = req.cookies as Record<string, string>;
    const redirectUri = cookies?.[OAUTH_REDIRECT_COOKIE] ?? '/';
    res.clearCookie(OAUTH_REDIRECT_COOKIE, { path: '/' });

    const gate = await this.checkTwoFactor(user, req, res);
    if (gate === 'pending') return { url: '/auth/two-factor', statusCode: HttpStatus.FOUND };

    const tokens = await createTokens();
    this.setTokenCookies(res, tokens, true, 'lax');
    return { url: redirectUri, statusCode: HttpStatus.FOUND };
  }
}
