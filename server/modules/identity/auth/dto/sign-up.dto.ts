import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN } from '../auth.constants';

export class SignUpDto {
  @ApiProperty()
  @IsString()
  name: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Callback URL after email verification' })
  @IsOptional()
  @IsString()
  callbackURL?: string;
}
