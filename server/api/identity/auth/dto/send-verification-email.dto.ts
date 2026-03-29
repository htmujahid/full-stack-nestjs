import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendVerificationEmailDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Callback URL after email verification' })
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
