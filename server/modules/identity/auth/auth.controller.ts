import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
  SESSION_REMEMBER_ME_EXPIRES_IN_MS,
} from './auth.constants';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up/email')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Sign up with email and password' })
  @ApiOkResponse({ description: 'User created; verification email sent' })
  async signUp(@Body() dto: SignUpDto) {
    const result = await this.authService.signUp(dto);
    return { user: result.user };
  }

  @Post('sign-in/email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ description: 'Returns session token and user' })
  async signIn(
    @Body() dto: SignInDto,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null;

    const result = await this.authService.signIn(dto, { ip, userAgent: userAgent ?? null });

    const rememberMe = dto.rememberMe !== false;
    const maxAge = rememberMe ? SESSION_REMEMBER_ME_EXPIRES_IN_MS : SESSION_EXPIRES_IN_MS;

    res.cookie(SESSION_COOKIE_NAME, result.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    if (dto.callbackURL) {
      res.redirect(dto.callbackURL);
      return;
    }

    return {
      token: result.session.token,
      user: result.user,
    };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email via token from link' })
  @Redirect()
  async verifyEmail(
    @Query('token') token: string,
    @Query('callbackURL') callbackURL?: string,
  ) {
    const result = await this.authService.verifyEmail(token);
    const base = callbackURL ?? '/';
    const url = result.ok ? base : base.includes('?') ? `${base}&error=${result.error}` : `${base}?error=${result.error}`;
    return { url };
  }
}
