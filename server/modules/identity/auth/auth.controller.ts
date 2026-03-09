import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';

const SESSION_COOKIE = 'session';
const SESSION_TTL_DAYS_SHORT = 7;
const SESSION_TTL_DAYS_LONG = 30;

@ApiTags('Auth')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up/email')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Sign up with email and password' })
  @ApiOkResponse({ description: 'User created and session started' })
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUp(dto);
    if (result.token) {
      const rememberMe = dto.rememberMe !== false;
      const maxAge =
        (rememberMe ? SESSION_TTL_DAYS_LONG : SESSION_TTL_DAYS_SHORT) *
        24 *
        60 *
        60 *
        1000;
      res.cookie(SESSION_COOKIE, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
    }
    return { token: result.token, user: result.user };
  }
}
