import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class UpdateEmailDto {
  @ApiProperty({ description: 'New email address' })
  @IsEmail()
  newEmail: string;
}
