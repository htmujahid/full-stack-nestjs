import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from './card.entity';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { RbacModule } from '../../identity/rbac/rbac.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [TypeOrmModule.forFeature([Card]), RbacModule, ProjectModule],
  controllers: [CardController],
  providers: [CardService],
})
export class CardModule {}
