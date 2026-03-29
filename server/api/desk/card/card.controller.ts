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
import { CardService } from './card.service';
import { CreateCardDto } from './dto/create-card.dto';
import { FindCardsDto } from './dto/find-cards.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

type AuthUser = { userId: string; role: UserRole };

// Route prefix: /api/cards (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get()
  @RequirePermissions('project:read')
  findAll(@Query() dto: FindCardsDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.cardService.findAll(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get(':id')
  @RequirePermissions('project:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cardService.findOne(id);
  }

  @Post()
  @RequirePermissions('project:create')
  create(@Body() dto: CreateCardDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.cardService.create(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Patch(':id')
  @RequirePermissions('project:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCardDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.cardService.update(id, dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('project:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.cardService.remove(id, {
      userId: user.userId,
      role: user.role,
    });
  }
}
