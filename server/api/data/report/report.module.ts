import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../desk/task/task.entity';
import { Project } from '../../desk/project/project.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { RbacModule } from '../../identity/rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Project]),
    RbacModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
