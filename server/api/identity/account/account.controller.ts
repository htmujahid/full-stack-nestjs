import { Controller, Get, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { AccountService } from './account.service';

@ApiTags('Accounts')
@ApiBearerAuth()
// Route prefix: /api/account (managed by RouterModule — see server/routes.ts)
@Controller()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'List all linked accounts for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the list of linked accounts',
  })
  listAccounts(@Request() req: ExpressRequest & { user: { userId: string } }) {
    return this.accountService.listAccounts(req.user.userId);
  }
}
