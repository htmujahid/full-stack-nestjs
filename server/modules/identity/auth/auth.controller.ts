import { Body, Controller, Get, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from './auth.constants';
import { SignUpDto } from './dto/sign-up.dto';

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
