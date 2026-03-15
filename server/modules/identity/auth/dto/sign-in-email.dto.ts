import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SignInEmailDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Redirect URL after sign-in' })
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
