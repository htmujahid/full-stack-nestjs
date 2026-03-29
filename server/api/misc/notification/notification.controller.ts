import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

@ApiTags('Notifications')
@ApiBearerAuth()
// Route prefix: /api/notifications (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member, UserRole.SuperAdmin)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Sse('stream')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'SSE stream for real-time notifications' })
  stream(@Req() req: Request): Observable<{ data: unknown }> {
    const user = req.user as AuthUser;
    return this.notificationService.getStream(user.userId).pipe(
      map((ev) => ({ data: ev.data })),
    );
  }

  @Get()
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'List notifications' })
  @ApiOkResponse({ description: 'Paginated notifications' })
  findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as AuthUser;
    return this.notificationService.findAll(
      user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post()
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Create notification (for current user)' })
  create(@Req() req: Request, @Body() dto: CreateNotificationDto) {
    const user = req.user as AuthUser;
    return this.notificationService.create(user.userId, dto);
  }

  @Post('group/:groupId')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Create notification for all team members' })
  createForGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationService.createForGroup(groupId, dto);
  }

  @Patch('read-all')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Req() req: Request) {
    const user = req.user as AuthUser;
    return this.notificationService.markAllRead(user.userId);
  }

  @Patch(':id/read')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const user = req.user as AuthUser;
    return this.notificationService.markRead(user.userId, id);
  }
}
