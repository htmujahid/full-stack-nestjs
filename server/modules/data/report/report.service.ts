import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../desk/task/task.entity';
import { Project } from '../../desk/project/project.entity';
import { TaskStatus } from '../../desk/task/task-status.enum';

export type ReportSummary = {
  projects: { total: number };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
  };
};

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async getSummary(userId: string): Promise<ReportSummary> {
    const [projectCount, tasks] = await Promise.all([
      this.projectRepo.count({ where: { userId } }),
      this.taskRepo.find({
        where: { project: { userId } },
        select: ['status'],
      }),
    ]);

    const byStatus: Record<string, number> = Object.values(TaskStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<string, number>,
    );
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    }

    return {
      projects: { total: projectCount },
      tasks: {
        total: tasks.length,
        byStatus,
      },
    };
  }
}
