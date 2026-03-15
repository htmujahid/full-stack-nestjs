import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator';
import { UserRole } from '../user/user-role.enum';

const ROLE_PERMISSIONS: Partial<Record<UserRole, string[]>> = {
  [UserRole.SuperAdmin]: [
    'project:read',
    'project:create',
    'project:update',
    'project:delete',
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'team:read',
    'team:create',
    'team:update',
    'team:delete',
    'audit:read',
    'analytics:read',
  ],
  [UserRole.Admin]: [
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'team:read',
    'team:create',
    'team:update',
    'team:delete',
    'audit:read',
    'analytics:read',
  ],
  [UserRole.Member]: [
    'project:read',
    'project:create',
    'project:update',
    'project:delete',
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { userId: string; role: UserRole } | undefined;

    if (!user?.role) throw new ForbiddenException();

    if (user.role === UserRole.SuperAdmin) return true;

    const allowed = ROLE_PERMISSIONS[user.role] ?? [];
    const hasAll = required.every((p) => allowed.includes(p));

    if (!hasAll) throw new ForbiddenException();

    return true;
  }
}
