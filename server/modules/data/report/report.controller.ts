import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ReportService } from './report.service';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

@ApiTags('Data Report')
@ApiBearerAuth()
@Controller('api/data/report')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('summary')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Get summary report (project/task counts by status)' })
  @ApiOkResponse({ description: 'Report summary' })
  async summary(@Req() req: Request) {
    const user = req.user as AuthUser;
    return this.reportService.getSummary(user.userId);
  }
}
