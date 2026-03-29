import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthMethod } from '../services/auth.service';

interface AuthenticatedUser {
  userId: string;
  authMethod: AuthMethod;
}

/**
 * Requires that the access token was issued via a direct login ('password' or
 * 'google'), not a token refresh. Use on sensitive endpoints where
 * re-authentication must be recent.
 *
 * Does NOT extend JwtAccessGuard — relies on the global JwtAccessGuard to
 * validate the token. Only checks freshness to avoid double passport execution.
 */
@Injectable()
export class JwtFreshGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new UnauthorizedException();
    if (user.authMethod === 'refresh') {
      throw new ForbiddenException('Re-authentication required');
    }
    return true;
  }
}
