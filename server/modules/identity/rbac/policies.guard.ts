import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { CaslAbilityFactory } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  type IPolicyHandler,
  type PolicyHandler,
  type PolicyHandlerCallback,
} from './check-policies.decorator';
import { User } from '../user/user.entity';
import type { AppAbility } from './casl-ability.factory';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ?? [];

    if (policyHandlers.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const userId = (request.user as { userId: string } | undefined)?.userId;

    if (!userId) throw new ForbiddenException();

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new ForbiddenException();

    const ability = this.caslAbilityFactory.createForUser(user);

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
