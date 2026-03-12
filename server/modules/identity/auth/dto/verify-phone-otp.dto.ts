import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class VerifyPhoneOtpDto {
  @ApiProperty({ description: 'Phone number in E.164 format' })
  @IsString()
  phone: string;

  @ApiProperty({ description: '6-digit OTP sent via SMS' })
  @IsString()
  code: string;

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
