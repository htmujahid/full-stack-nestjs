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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PoliciesGuard } from '../../identity/rbac/policies.guard';
import { CheckPolicies } from '../../identity/rbac/check-policies.decorator';
import { Action } from '../../identity/rbac/action.enum';
import { Project } from './project.entity';

@Controller('api/projects')
@UseGuards(PoliciesGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, Project))
  findAll() {
    return this.projectService.findAll();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can(Action.Read, Project))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectService.findOne(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can(Action.Create, Project))
  create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.create(dto, userId);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(Action.Update, Project))
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies((ability) => ability.can(Action.Delete, Project))
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectService.remove(id);
  }
}
