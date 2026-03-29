import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../desk/task/task.entity';
import { Project } from '../../desk/project/project.entity';

export type ExportEntity = 'tasks' | 'projects';
export type ExportFormat = 'csv' | 'json';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async export(
    entity: ExportEntity,
    format: ExportFormat,
    userId: string,
  ): Promise<string | Record<string, unknown>[]> {
    const rows = await this.fetchData(entity, userId);

    if (format === 'json') return rows;

    return this.toCsv(rows);
  }

  private async fetchData(
    entity: ExportEntity,
    userId: string,
  ): Promise<Record<string, unknown>[]> {
    if (entity === 'tasks') {
      const tasks = await this.taskRepo.find({
        where: { project: { userId } },
        relations: ['project'],
        order: { createdAt: 'DESC' },
      });
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        projectId: t.projectId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
    }

    if (entity === 'projects') {
      const projects = await this.projectRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        userId: p.userId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    }

    return [];
  }

  private toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]!);
    const escape = (v: unknown): string => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
    ];
    return lines.join('\n');
  }
}
