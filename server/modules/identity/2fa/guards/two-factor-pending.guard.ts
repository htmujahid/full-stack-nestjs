import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { TFA_PENDING_COOKIE } from '../../auth/auth.constants';

@Injectable()
export class TwoFactorPendingGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const token = (req.cookies as Record<string, string>)?.[TFA_PENDING_COOKIE];
    if (!token) throw new UnauthorizedException('No pending 2FA session');

    const secret = this.configService.getOrThrow<string>('auth.accessSecret');
    let payload: { sub?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    if (payload.type !== '2fa_pending' || !payload.sub) {
      throw new UnauthorizedException('Invalid 2FA session');
    }

    req.user = { userId: payload.sub };
    return true;
  }
}
