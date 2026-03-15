import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindTasksDto } from './dto/find-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './task-status.enum';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';

export type AuthContext = { userId: string; role: UserRole };

export type TasksPage = {
  data: Task[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly projectService: ProjectService,
  ) {}

  async findAll(dto: FindTasksDto, auth: AuthContext): Promise<TasksPage> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.taskRepository.createQueryBuilder('task');

    if (dto.search) {
      qb.andWhere(
        '(task.title LIKE :search OR task.description LIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    if (dto.projectId) {
      qb.andWhere('task.projectId = :projectId', { projectId: dto.projectId });
    }

    if (dto.status && dto.status.length > 0) {
      qb.andWhere('task.status IN (:...statuses)', { statuses: dto.status });
    }

    const sortBy = dto.sortBy ?? 'createdAt';
    const sortOrder = (dto.sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`task.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: { project: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(dto: CreateTaskDto, auth: AuthContext): Promise<Task> {
    const project = await this.projectService.findOne(dto.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    const task = this.taskRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.Todo,
      projectId: dto.projectId,
    });
    return this.taskRepository.save(task);
  }

  async update(id: string, dto: UpdateTaskDto, auth: AuthContext): Promise<Task> {
    const task = await this.findOne(id);
    const project = await this.projectService.findOne(task.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    Object.assign(task, dto);
    return this.taskRepository.save(task);
  }

  async remove(id: string, auth: AuthContext): Promise<void> {
    const task = await this.findOne(id);
    const project = await this.projectService.findOne(task.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    await this.taskRepository.remove(task);
  }
}
