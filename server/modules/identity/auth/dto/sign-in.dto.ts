import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'Keep session alive for 30 days. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @ApiPropertyOptional({ description: 'Redirect URL after sign-in' })
  @IsOptional()
  @IsString()
  callbackURL?: string;
}
