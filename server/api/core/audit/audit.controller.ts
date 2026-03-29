import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { FindAuditLogsDto } from './dto/find-audit-logs.dto';
import { JwtAccessGuard } from '../../identity/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

// Route prefix: /api/audit (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Admin)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  @Get()
  @RequirePermissions('audit:read')
  async findMany(@Query() dto: FindAuditLogsDto) {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(dto.limit ?? 50, 100))
      .skip(dto.offset ?? 0);

    if (dto.actorId)
      qb.andWhere('a.actorId = :actorId', { actorId: dto.actorId });
    if (dto.action) qb.andWhere('a.action = :action', { action: dto.action });
    if (dto.resourceType)
      qb.andWhere('a.resourceType = :resourceType', {
        resourceType: dto.resourceType,
      });
    if (dto.resourceId)
      qb.andWhere('a.resourceId = :resourceId', { resourceId: dto.resourceId });
    if (dto.tenantId)
      qb.andWhere('a.tenantId = :tenantId', { tenantId: dto.tenantId });
    if (dto.from) qb.andWhere('a.createdAt >= :from', { from: dto.from });
    if (dto.to) qb.andWhere('a.createdAt <= :to', { to: dto.to });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
