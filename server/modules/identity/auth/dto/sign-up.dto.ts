import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN } from '../auth.constants';

export class SignUpDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Unique username (letters, numbers, underscores, hyphens)' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must be at most 30 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username may only contain letters, numbers, underscores, and hyphens',
  })
  username?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN })
  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `Password must be at least ${PASSWORD_MIN} characters`,
  })
  @MaxLength(PASSWORD_MAX, {
    message: `Password must be at most ${PASSWORD_MAX} characters`,
  })
  password: string;

  @ApiPropertyOptional({ description: 'Phone number in E.164 format, e.g. +12345678900' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Callback URL after email verification' })
  @IsOptional()
  @IsString()
  callbackURL?: string;
}
