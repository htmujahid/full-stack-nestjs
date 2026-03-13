import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CaslAbilityFactory } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  type IPolicyHandler,
  type PolicyHandler,
  type PolicyHandlerCallback,
} from './check-policies.decorator';
import { UserRole } from '../user/user-role.enum';
import type { AppAbility } from './casl-ability.factory';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ?? [];

    if (policyHandlers.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as
      | { userId: string; role: UserRole }
      | undefined;

    if (!user?.userId || !user.role) throw new ForbiddenException();

    const ability = this.caslAbilityFactory.createForUser({
      id: user.userId,
      role: user.role,
    });

    const allowed = policyHandlers.every((handler) =>
      this.execPolicyHandler(handler, ability),
    );

    if (!allowed) throw new ForbiddenException();
    return true;
  }

  private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
    if (typeof handler === 'function') {
      return (handler as PolicyHandlerCallback)(ability);
    }
    return (handler as IPolicyHandler).handle(ability);
  }
}
