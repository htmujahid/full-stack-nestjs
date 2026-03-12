import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { PhoneService } from '../services/phone.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from '../auth.constants';
import { BaseAuthController } from './base-auth.controller';
import { SignInPhoneDto } from '../dto/sign-in-phone.dto';
import { VerifyPhoneOtpDto } from '../dto/verify-phone-otp.dto';
import { SendVerificationPhoneDto } from '../dto/send-verification-phone.dto';
import { VerifyPhoneDto } from '../dto/verify-phone.dto';
import { UpdatePhoneDto } from '../dto/update-phone.dto';
import { VerifyPhoneChangeDto } from '../dto/verify-phone-change.dto';
import { Public } from '../decorators/public.decorator';
import { JwtFreshGuard } from '../guards/jwt-fresh.guard';

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class PhoneController extends BaseAuthController {
  constructor(
    private readonly phoneService: PhoneService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate);
  }

  @Public()
  @Post('sign-in/phone')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Request OTP to sign in with phone number' })
  @ApiOkResponse({
    description: 'Always returns ok; does not leak whether account exists',
  })
  async sendSignInOtp(@Body() dto: SignInPhoneDto) {
    await this.phoneService.sendSignInOtp(dto.phone);
    return { ok: true };
  }

  @Public()
  @Post('verify-phone-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Verify OTP and sign in with phone number' })
  @ApiOkResponse({ description: 'Sets access and refresh token cookies' })
  async verifySignInOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
    @Request() req: ExpressRequest,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const rememberMe = dto.rememberMe !== false;

    const result = await this.phoneService.verifySignInOtp(
      dto.phone,
      dto.code,
      rememberMe,
      { ip, userAgent: userAgent ?? null },
    );

    const gate = await this.checkTwoFactor(result.user, req, res);
    if (gate === 'pending') return { twoFactorRedirect: true };

    this.setTokenCookies(res, result.tokens, rememberMe);
    return {
      url: dto.callbackURL ?? null,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    };
  }

  @Public()
  @Post('send-verification-phone')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Send or resend phone verification OTP' })
  @ApiOkResponse({
    description: 'Always returns ok; does not leak whether account exists',
  })
  async sendVerificationOtp(@Body() dto: SendVerificationPhoneDto) {
    await this.phoneService.sendVerificationOtp(dto.phone);
    return { ok: true };
  }

  @Public()
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Verify phone number via OTP' })
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    const result = await this.phoneService.verifyPhone(dto.phone, dto.code);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }

  @UseGuards(JwtFreshGuard)
  @Patch('phone')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({
    summary: 'Request phone number change (requires recent re-authentication)',
  })
  @ApiOkResponse({ description: 'OTP sent to new phone number' })
  async updatePhone(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: UpdatePhoneDto,
  ) {
    await this.phoneService.initiatePhoneChange(req.user.userId, dto.newPhone);
    return { ok: true };
  }

  @Public()
  @Post('verify-phone-change')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @ApiOperation({ summary: 'Confirm phone number change via OTP' })
  async verifyPhoneChange(@Body() dto: VerifyPhoneChangeDto) {
    const result = await this.phoneService.verifyPhoneChange(dto.phone, dto.code);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }
}
