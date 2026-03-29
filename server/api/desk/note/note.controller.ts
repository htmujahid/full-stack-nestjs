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
import { NoteService } from './note.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { FindNotesDto } from './dto/find-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

@Controller('api/notes')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Get()
  @RequirePermissions('project:read')
  findAll(@Query() dto: FindNotesDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.noteService.findAll(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get(':id')
  @RequirePermissions('project:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noteService.findOne(id);
  }

  @Post()
  @RequirePermissions('project:create')
  create(@Body() dto: CreateNoteDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.noteService.create(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Patch(':id')
  @RequirePermissions('project:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.noteService.update(id, dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('project:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.noteService.remove(id, {
      userId: user.userId,
      role: user.role,
    });
  }
}
