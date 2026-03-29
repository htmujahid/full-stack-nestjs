import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateMeDto } from './update-me.dto';
import type { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';

@ApiTags('Me')
@ApiBearerAuth()
// Route prefix: /api/me (managed by RouterModule — see server/routes.ts)
@Controller()
export class MeController {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ description: 'Returns the authenticated user' })
  async me(@Request() req: ExpressRequest & { user: { userId: string } }) {
    return this.userRepo.findOneOrFail({ where: { id: req.user.userId } });
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ description: 'Returns the updated user' })
  async updateMe(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: UpdateMeDto,
  ) {
    const { userId } = req.user;
    if (Object.keys(dto).length > 0) {
      await this.userRepo.update(userId, dto);
    }
    return this.userRepo.findOneOrFail({ where: { id: userId } });
  }
}
