import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { CaslModule } from '../../identity/rbac/casl.module';
import { UserModule } from '../../identity/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), CaslModule, UserModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
