import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { TFA_PENDING_COOKIE } from '../../auth/auth.constants';

@Injectable()
export class TwoFactorPendingGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const token = (req.cookies as Record<string, string>)?.[TFA_PENDING_COOKIE];
    if (!token) throw new UnauthorizedException('No pending 2FA session');

    let payload: { sub?: string; role?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    if (payload.type !== '2fa_pending' || !payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid 2FA session');
    }

    req.user = { userId: payload.sub, role: payload.role };
    return true;
  }
}
