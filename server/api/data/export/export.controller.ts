import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ExportService, type ExportEntity, type ExportFormat } from './export.service';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

@ApiTags('Data Export')
@ApiBearerAuth()
// Route prefix: /api/data/export (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Export tasks or projects as CSV or JSON' })
  @ApiQuery({ name: 'entity', enum: ['tasks', 'projects'] })
  @ApiQuery({ name: 'format', enum: ['csv', 'json'] })
  @ApiOkResponse({ description: 'Exported data' })
  async export(
    @Query('entity') entity: ExportEntity = 'tasks',
    @Query('format') format: ExportFormat = 'csv',
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as AuthUser;
    const result = await this.exportService.export(entity, format, user.userId);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${entity}-export.csv"`,
      );
      return result;
    }
    return result;
  }
}
