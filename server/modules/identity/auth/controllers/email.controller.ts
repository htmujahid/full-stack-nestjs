import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Redirect,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { EmailService } from '../services/email.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from '../auth.constants';
import { BaseAuthController } from './base-auth.controller';
import { SignInEmailDto } from '../dto/sign-in-email.dto';
import { SendVerificationEmailDto } from '../dto/send-verification-email.dto';
import { UpdateEmailDto } from '../dto/update-email.dto';
import { Public } from '../decorators/public.decorator';
import { JwtFreshGuard } from '../guards/jwt-fresh.guard';

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class EmailController extends BaseAuthController {
  constructor(
    private readonly emailService: EmailService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate);
  }

  @Public()
  @Post('sign-in/email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Send a magic sign-in link to the email address' })
  @ApiOkResponse({
    description: 'Always returns ok; does not leak whether account exists',
  })
  async sendSignInLink(@Body() dto: SignInEmailDto) {
    await this.emailService.sendSignInLink(
      dto.email,
      dto.callbackURL,
      dto.errorURL,
    );
    return { ok: true };
  }

  @Public()
  @Get('verify-email-link')
  @Redirect()
  @ApiOperation({ summary: 'Verify magic sign-in link and issue tokens' })
  async verifySignInLink(
    @Query('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Query('errorURL') errorURL: string | undefined,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
    @Request() req: ExpressRequest,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const result = await this.emailService.verifySignInLink(token, {
      ip,
      userAgent: userAgent ?? null,
    });

    if (!result.ok) {
      const errorTarget = errorURL ?? '/auth/error';
      const sep = errorTarget.includes('?') ? '&' : '?';
      return {
        url: `${errorTarget}${sep}error=${encodeURIComponent(result.error)}`,
        statusCode: HttpStatus.FOUND,
      };
    }

    const gate = await this.checkTwoFactor(result.user, req, res);
    if (gate === 'pending') {
      return { url: '/auth/two-factor', statusCode: HttpStatus.FOUND };
    }

    this.setTokenCookies(res, result.tokens, false);
    return {
      url: callbackURL ?? '/',
      statusCode: HttpStatus.FOUND,
    };
  }

  @Public()
  @Post('send-verification-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Send or resend verification email' })
  @ApiOkResponse({
    description: 'Always returns ok; does not leak whether account exists',
  })
  async sendVerificationEmail(@Body() dto: SendVerificationEmailDto) {
    await this.emailService.resendVerificationEmail(
      dto.email,
      dto.callbackURL,
      dto.errorURL,
    );
    return { ok: true };
  }

  @Public()
  @Get('verify-email')
  @Redirect()
  @ApiOperation({ summary: 'Verify email via token from link' })
  async verifyEmail(
    @Query('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Query('errorURL') errorURL: string | undefined,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const result = await this.emailService.verifyEmail(token, {
      ip,
      userAgent: userAgent ?? null,
    });

    if (!result.ok) {
      const errorTarget = errorURL ?? '/auth/error';
      const sep = errorTarget.includes('?') ? '&' : '?';
      return {
        url: `${errorTarget}${sep}error=${encodeURIComponent(result.error)}`,
        statusCode: HttpStatus.FOUND,
      };
    }

    this.setTokenCookies(res, result.tokens, false);
    return { url: callbackURL ?? '/', statusCode: HttpStatus.FOUND };
  }

  @UseGuards(JwtFreshGuard)
  @Patch('email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({
    summary: 'Request email change (requires recent re-authentication)',
  })
  @ApiOkResponse({ description: 'Verification email sent to new address' })
  async updateEmail(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: UpdateEmailDto,
  ) {
    await this.emailService.initiateEmailChange(
      req.user.userId,
      dto.newEmail,
      dto.callbackURL,
      dto.errorURL,
    );
    return { ok: true };
  }

  @Public()
  @Get('verify-email-change')
  @Redirect()
  @ApiOperation({ summary: 'Confirm email change via token from link' })
  async verifyEmailChange(
    @Query('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Query('errorURL') errorURL: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.emailService.verifyEmailChange(token);
    if (!result.ok) {
      const errorTarget = errorURL ?? '/auth/error';
      const sep = errorTarget.includes('?') ? '&' : '?';
      return {
        url: `${errorTarget}${sep}error=${encodeURIComponent(result.error)}`,
        statusCode: HttpStatus.FOUND,
      };
    }
    return { url: callbackURL ?? '/', statusCode: HttpStatus.FOUND };
  }
}
