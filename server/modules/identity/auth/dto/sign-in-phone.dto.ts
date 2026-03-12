import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SignInPhoneDto {
  @ApiProperty({ description: 'Phone number in E.164 format, e.g. +12345678900' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Redirect URL after sign-in' })
  @IsOptional()
  @IsString()
  callbackURL?: string;
}
