import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPhoneDto {
  @ApiProperty({ description: 'Phone number in E.164 format' })
  @IsString()
  phone: string;

  @ApiProperty({ description: '6-digit OTP sent via SMS' })
  @IsString()
  code: string;
}
