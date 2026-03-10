import { Controller, Get, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';

@ApiTags('Me')
@ApiBearerAuth()
@Controller('api/me')
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
}
