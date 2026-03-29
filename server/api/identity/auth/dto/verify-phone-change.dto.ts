import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPhoneChangeDto {
  @ApiProperty({ description: 'New phone number in E.164 format' })
  @IsString()
  phone: string;

  @ApiProperty({ description: '6-digit OTP sent to the new phone number' })
  @IsString()
  code: string;
}
