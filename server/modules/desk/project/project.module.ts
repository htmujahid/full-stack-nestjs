import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { RbacModule } from '../../identity/rbac/rbac.module';
import { UserModule } from '../../identity/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), RbacModule, UserModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
