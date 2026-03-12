import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorPendingGuard } from './guards/two-factor-pending.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { JwtFreshGuard } from '../auth/guards/jwt-fresh.guard';
import { BaseAuthController } from '../auth/controllers/base-auth.controller';
import { TwoFactorGateService } from '../auth/services/two-factor-gate.service';
import { EnableTwoFactorDto } from './dto/enable-two-factor.dto';
import { DisableTwoFactorDto } from './dto/disable-two-factor.dto';
import { GetTotpUriDto } from './dto/get-totp-uri.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { VerifyEnableTotpDto } from './dto/verify-enable-totp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyBackupCodeDto } from './dto/verify-backup-code.dto';
import { GenerateBackupCodesDto } from './dto/generate-backup-codes.dto';
import {
  TFA_PENDING_COOKIE,
  TRUST_DEVICE_COOKIE,
} from '../auth/auth.constants';

const TFA_THROTTLE = { default: { limit: 3, ttl: 10_000 } };

@ApiTags('Two-Factor Auth')
@Controller('api/two-factor')
@UseGuards(ThrottlerGuard)
export class TwoFactorController extends BaseAuthController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    twoFactorGate: TwoFactorGateService,
  ) {
    super(twoFactorGate);
  }

  @UseGuards(JwtAccessGuard)
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Enable 2FA — returns TOTP URI and backup codes' })
  @ApiOkResponse({
    description: 'TOTP URI for QR code and one-time backup codes',
  })
  async enable(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: EnableTwoFactorDto,
  ) {
    return this.twoFactorService.enable(req.user.userId, dto);
  }

  @UseGuards(JwtFreshGuard)
  @Post('enable/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Confirm 2FA enable by verifying TOTP code' })
  async verifyEnable(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: VerifyEnableTotpDto,
  ) {
    await this.twoFactorService.verifyEnableTotp(req.user.userId, dto.code);
    return { ok: true };
  }

  @UseGuards(JwtAccessGuard)
  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Disable 2FA — requires password confirmation' })
  async disable(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: DisableTwoFactorDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.twoFactorService.disable(req.user.userId, dto.password);
    res.clearCookie(TRUST_DEVICE_COOKIE);
    return { ok: true };
  }

  @UseGuards(JwtAccessGuard)
  @Post('get-totp-uri')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Get TOTP URI — requires password confirmation' })
  async getTotpUri(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: GetTotpUriDto,
  ) {
    const totpURI = await this.twoFactorService.getTotpUri(
      req.user.userId,
      dto.password,
    );
    return { totpURI };
  }

  @UseGuards(TwoFactorPendingGuard)
  @Post('verify-totp')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Verify TOTP code to complete sign-in' })
  async verifyTotp(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: VerifyTotpDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const { tokens, trustCookieValue } = await this.twoFactorService.verifyTotp(
      req.user.userId,
      dto.code,
      dto.trustDevice ?? false,
      { ip, userAgent: userAgent ?? null },
    );
    res.clearCookie(TFA_PENDING_COOKIE);
    this.setTokenCookies(res, tokens, false);
    if (trustCookieValue) {
      this.setTrustDeviceCookie(res, trustCookieValue);
    }
    return {
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @UseGuards(TwoFactorPendingGuard)
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Send OTP to email for 2FA verification' })
  async sendOtp(@Request() req: ExpressRequest & { user: { userId: string } }) {
    await this.twoFactorService.sendOtp(req.user.userId);
    return { ok: true };
  }

  @UseGuards(TwoFactorPendingGuard)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Verify email OTP code to complete sign-in' })
  async verifyOtp(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: VerifyOtpDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const { tokens, trustCookieValue } = await this.twoFactorService.verifyOtp(
      req.user.userId,
      dto.code,
      dto.trustDevice ?? false,
      { ip, userAgent: userAgent ?? null },
    );
    res.clearCookie(TFA_PENDING_COOKIE);
    this.setTokenCookies(res, tokens, false);
    if (trustCookieValue) {
      this.setTrustDeviceCookie(res, trustCookieValue);
    }
    return {
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @UseGuards(TwoFactorPendingGuard)
  @Post('verify-backup-code')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Verify backup code to complete sign-in' })
  async verifyBackupCode(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: VerifyBackupCodeDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;
    const { tokens, trustCookieValue } =
      await this.twoFactorService.verifyBackupCode(
        req.user.userId,
        dto.code,
        dto.trustDevice ?? false,
        { ip, userAgent: userAgent ?? null },
      );
    res.clearCookie(TFA_PENDING_COOKIE);
    this.setTokenCookies(res, tokens, false);
    if (trustCookieValue) {
      this.setTrustDeviceCookie(res, trustCookieValue);
    }
    return {
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @UseGuards(JwtAccessGuard)
  @Post('generate-backup-codes')
  @HttpCode(HttpStatus.OK)
  @Throttle(TFA_THROTTLE)
  @ApiOperation({ summary: 'Regenerate backup codes — invalidates old ones' })
  async generateBackupCodes(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Body() dto: GenerateBackupCodesDto,
  ) {
    const backupCodes = await this.twoFactorService.generateBackupCodes(
      req.user.userId,
      dto.password,
    );
    return { backupCodes };
  }
}
