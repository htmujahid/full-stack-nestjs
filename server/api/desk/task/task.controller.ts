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
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindTasksDto } from './dto/find-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

// Route prefix: /api/tasks (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @RequirePermissions('project:read')
  findAll(@Query() dto: FindTasksDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.taskService.findAll(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get(':id')
  @RequirePermissions('project:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.findOne(id);
  }

  @Post()
  @RequirePermissions('project:create')
  create(@Body() dto: CreateTaskDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.taskService.create(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Patch(':id')
  @RequirePermissions('project:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.taskService.update(id, dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('project:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.taskService.remove(id, {
      userId: user.userId,
      role: user.role,
    });
  }
}
