import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { OAUTH_REDIRECT_COOKIE, OAUTH_REDIRECT_EXPIRES_MS } from '../../auth/auth.constants';

/**
 * Wraps any passport AuthGuard with redirect-URI capture logic.
 * On the initiation request (?redirectUri=/some/path), stores the
 * value in a short-lived cookie so the callback can redirect there
 * after OAuth completes.
 *
 * Usage:
 *   @Injectable()
 *   export class GoogleAuthGuard extends withOAuthRedirect(AuthGuard('google')) {}
 */
export function withOAuthRedirect(Base: ReturnType<typeof AuthGuard>) {
  class OAuthRedirectGuard extends Base {
    override canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<{
        query: Record<string, string | undefined>;
        path: string;
      }>();

      if (!req.path.endsWith('/callback')) {
        const redirectUri = req.query['redirectUri'];
        if (redirectUri?.startsWith('/')) {
          const res = context.switchToHttp().getResponse<Response>();
          res.cookie(OAUTH_REDIRECT_COOKIE, redirectUri, {
            httpOnly: true,
            maxAge: OAUTH_REDIRECT_EXPIRES_MS,
            path: '/',
            sameSite: 'lax',
          });
        }
      }

      return super.canActivate(context);
    }
  }
  return OAuthRedirectGuard;
}
