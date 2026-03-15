import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FindAnalyticsEventsDto } from './dto/find-analytics-events.dto';
import { JwtAccessGuard } from '../../identity/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';

@Controller('api/analytics')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Admin)
export class AnalyticsController {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
  ) {}

  @Get('events')
  @RequirePermissions('analytics:read')
  async findMany(@Query() dto: FindAnalyticsEventsDto) {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .take(Math.min(dto.limit ?? 50, 100))
      .skip(dto.offset ?? 0);

    if (dto.event) qb.andWhere('e.event = :event', { event: dto.event });
    if (dto.actorId)
      qb.andWhere('e.actorId = :actorId', { actorId: dto.actorId });
    if (dto.sessionId)
      qb.andWhere('e.sessionId = :sessionId', { sessionId: dto.sessionId });
    if (dto.tenantId)
      qb.andWhere('e.tenantId = :tenantId', { tenantId: dto.tenantId });
    if (dto.from) qb.andWhere('e.createdAt >= :from', { from: dto.from });
    if (dto.to) qb.andWhere('e.createdAt <= :to', { to: dto.to });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
