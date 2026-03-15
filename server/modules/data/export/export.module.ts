import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../desk/task/task.entity';
import { Project } from '../../desk/project/project.entity';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { RbacModule } from '../../identity/rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Project]),
    RbacModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
