import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Callback URL after password reset' })
  @IsOptional()
  @IsString()
  callbackURL?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect on error (e.g. invalid token)',
  })
  @IsOptional()
  @IsString()
  errorURL?: string;
}
