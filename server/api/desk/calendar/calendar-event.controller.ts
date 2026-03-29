import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CalendarEventService } from './calendar-event.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { FindCalendarEventsDto } from './dto/find-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

// Route prefix: /api/calendar-events (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class CalendarEventController {
  constructor(private readonly calendarEventService: CalendarEventService) {}

  @Get()
  @RequirePermissions('project:read')
  findAll(@Query() dto: FindCalendarEventsDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.calendarEventService.findAll(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get(':id')
  @RequirePermissions('project:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarEventService.findOne(id);
  }

  @Post()
  @RequirePermissions('project:create')
  create(@Body() dto: CreateCalendarEventDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.calendarEventService.create(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Patch(':id')
  @RequirePermissions('project:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.calendarEventService.update(id, dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('project:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.calendarEventService.remove(id, {
      userId: user.userId,
      role: user.role,
    });
  }
}
