import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Redirect,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest, Response } from 'express';
import { AccountService } from './account.service';
import { LINK_INTENT_COOKIE, LINK_INTENT_EXPIRES_MS } from '../auth/auth.constants';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('api/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'List all linked accounts for the current user' })
  @ApiResponse({ status: 200, description: 'Returns the list of linked accounts' })
  listAccounts(@Request() req: ExpressRequest & { user: { userId: string } }) {
    return this.accountService.listAccounts(req.user.userId);
  }

  @Patch(':providerId')
  @Redirect()
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Initiate account link for a given provider' })
  @ApiResponse({ status: 302, description: 'Redirects to the provider OAuth flow' })
  linkAccount(@Param('providerId') providerId: string, @Res() res: Response) {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(LINK_INTENT_COOKIE, providerId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: LINK_INTENT_EXPIRES_MS,
    });
    return { url: `/api/auth/${providerId}`, statusCode: HttpStatus.FOUND };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an account by ID' })
  @ApiResponse({ status: 200, description: 'Account unlinked successfully' })
  async unlinkAccount(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.accountService.unlinkAccount(req.user.userId, id);
    return { success: true };
  }
}
