import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateBackupCodesDto {
  @ApiProperty()
  @IsString()
  password: string;
}
