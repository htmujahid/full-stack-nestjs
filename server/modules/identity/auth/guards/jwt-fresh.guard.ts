import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtAccessGuard } from './jwt-access.guard';
import type { AuthMethod } from '../services/auth.service';

interface AuthenticatedUser {
  userId: string;
  authMethod: AuthMethod;
}

/**
 * Extends JwtAccessGuard to additionally require that the access token was
 * issued via a direct login ('password' or 'google'), not a token refresh.
 * Use this on sensitive endpoints where re-authentication must be recent.
 */
@Injectable()
export class JwtFreshGuard extends JwtAccessGuard {
  handleRequest<T>(err: Error | null, user: T): T {
    super.handleRequest(err, user);
    if ((user as unknown as AuthenticatedUser).authMethod === 'refresh') {
      throw new ForbiddenException('Re-authentication required');
    }
    return user;
  }
}
