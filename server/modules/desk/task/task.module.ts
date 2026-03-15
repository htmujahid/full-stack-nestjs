import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { RbacModule } from '../../identity/rbac/rbac.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    RbacModule,
    ProjectModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
