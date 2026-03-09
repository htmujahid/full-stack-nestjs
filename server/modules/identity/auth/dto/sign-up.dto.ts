import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

export class SignUpDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: MIN_PASSWORD })
  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Password must be at least ${MIN_PASSWORD} characters`,
  })
  @MaxLength(MAX_PASSWORD, {
    message: `Password must be at most ${MAX_PASSWORD} characters`,
  })
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Callback URL after email verification' })
  @IsOptional()
  @IsString()
  callbackURL?: string;

  @ApiPropertyOptional({ description: 'If false, session expires sooner. Default true.' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export const PASSWORD_MIN = MIN_PASSWORD;
export const PASSWORD_MAX = MAX_PASSWORD;
