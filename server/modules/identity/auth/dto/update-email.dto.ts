import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateEmailDto {
  @ApiProperty({ description: 'New email address' })
  @IsEmail()
  newEmail: string;

  @ApiPropertyOptional({ description: 'Callback URL after email change confirmation' })
  @IsOptional()
  @IsString()
  callbackURL?: string;

  @ApiPropertyOptional({ description: 'URL to redirect on error (e.g. invalid token)' })
  @IsOptional()
  @IsString()
  errorURL?: string;
}
