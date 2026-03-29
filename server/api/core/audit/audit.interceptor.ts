import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../identity/auth/decorators/public.decorator';
import { AuditService } from './audit.service';
import { AUDIT_KEY, type AuditOptions } from './decorators/audit.decorator';

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string')
    return forwarded.split(',')[0]?.trim() ?? null;
  return req.socket?.remoteAddress ?? null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.getAllAndOverride<AuditOptions | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return next.handle();

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { userId: string } }>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (opts.requireAuth !== false && (isPublic || !req.user?.userId)) {
      return next.handle();
    }

    const actorId = req.user?.userId ?? null;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? null;
    const resourceId = opts.resourceIdParam
      ? (req.params?.[opts.resourceIdParam] as string | undefined)
      : undefined;

    return next.handle().pipe(
      tap((result) => {
        void this.auditService.log({
          actorId,
          action: opts.action,
          resourceType: opts.resourceType,
          resourceId: resourceId ?? null,
          newValue:
            result != null && typeof result === 'object'
              ? (result as Record<string, unknown>)
              : undefined,
          ip,
          userAgent,
        });
      }),
    );
  }
}
