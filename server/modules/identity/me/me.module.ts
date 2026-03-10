import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { MeController } from './me.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [MeController],
})
export class MeModule {}
