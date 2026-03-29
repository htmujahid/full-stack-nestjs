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
  UseGuards,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { FindTeamsDto } from './dto/find-teams.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { RolesGuard } from '../rbac/roles.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Roles } from '../rbac/roles.decorator';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { UserRole } from '../user/user-role.enum';
import { TeamMemberRole } from './team-member-role.enum';

@Controller('api/identity/teams')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.SuperAdmin, UserRole.Admin)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermissions('team:read')
  findAll(@Query() dto: FindTeamsDto) {
    return this.teamService.findAll(dto);
  }

  @Get(':id')
  @RequirePermissions('team:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamService.findOne(id);
  }

  @Post()
  @RequirePermissions('team:create')
  create(@Body() dto: CreateTeamDto) {
    return this.teamService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('team:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeamDto) {
    return this.teamService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('team:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamService.remove(id);
  }

  @Post(':id/members')
  @RequirePermissions('team:update')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.teamService.addMember(
      id,
      dto.userId,
      dto.role ?? TeamMemberRole.Member,
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('team:update')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamService.removeMember(id, userId);
  }

  @Patch(':id/members/:userId')
  @RequirePermissions('team:update')
  updateMemberRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamService.updateMemberRole(id, userId, dto.role);
  }
}
