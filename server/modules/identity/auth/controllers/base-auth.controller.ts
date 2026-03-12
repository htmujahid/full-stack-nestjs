import type { Response } from 'express';
import type { TokenPair } from '../services/auth.service';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
  TFA_PENDING_COOKIE,
  TFA_PENDING_EXPIRES_MS,
  TRUST_DEVICE_COOKIE,
  TRUST_DEVICE_EXPIRES_MS,
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

  protected setPendingCookie(res: Response, token: string): void {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(TFA_PENDING_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/two-factor',
      maxAge: TFA_PENDING_EXPIRES_MS,
    });
  }

  protected setTrustDeviceCookie(res: Response, value: string): void {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(TRUST_DEVICE_COOKIE, value, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: TRUST_DEVICE_EXPIRES_MS,
    });
  }
}
