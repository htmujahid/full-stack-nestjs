import type { Response } from 'express';
import type { TokenPair } from '../services/auth.service';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
} from '../auth.constants';

export abstract class BaseAuthController {
  protected setTokenCookies(
    res: Response,
    tokens: TokenPair,
    rememberMe: boolean,
    sameSite: 'strict' | 'lax' = 'strict',
  ): void {
    const secure = process.env.NODE_ENV === 'production';

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: ACCESS_EXPIRES_MS,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/auth',
      maxAge: rememberMe ? REFRESH_REMEMBER_ME_EXPIRES_MS : REFRESH_EXPIRES_MS,
    });
  }
}
