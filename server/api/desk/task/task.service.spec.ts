import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskService } from './task.service';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindTasksDto } from './dto/find-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './task-status.enum';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    title: 'Test Task',
    description: null,
    status: TaskStatus.Todo,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Task;

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'project-1',
  userId: 'user-1',
  ...overrides,
});

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

const auth = { userId: 'user-1', role: UserRole.Member } as const;

describe('TaskService', () => {
  let service: TaskService;
  let taskRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let projectService: { findOne: jest.Mock };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    taskRepo = {
      ...mockRepository(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    taskRepo.createQueryBuilder.mockReturnValue(qb);

    projectService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: ProjectService, useValue: projectService },
      ],
    }).compile();

    service = module.get(TaskService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns TasksPage with data, total, page, limit', async () => {
      const tasks = [makeTask(), makeTask({ id: 'task-2', title: 'Second' })];
      qb.getManyAndCount.mockResolvedValue([tasks, 2]);

      const dto: FindTasksDto = {};
      const result = await service.findAll(dto, auth);

      expect(taskRepo.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(qb.orderBy).toHaveBeenCalledWith('task.createdAt', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: tasks, total: 2, page: 1, limit: 20 });
    });

    it('adds andWhere for search when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'bug' }, auth);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(task.title LIKE :search OR task.description LIKE :search)',
        { search: '%bug%' },
      );
    });

    it('adds andWhere for projectId when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ projectId: 'proj-123' }, auth);

      expect(qb.andWhere).toHaveBeenCalledWith('task.projectId = :projectId', {
        projectId: 'proj-123',
      });
    });

    it('adds andWhere for status array when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { status: [TaskStatus.Todo, TaskStatus.Done] },
        auth,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'task.status IN (:...statuses)',
        { statuses: [TaskStatus.Todo, TaskStatus.Done] },
      );
    });

    it('applies pagination and sortBy', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { page: 2, limit: 10, sortBy: 'title', sortOrder: 'asc' },
        auth,
      );

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.orderBy).toHaveBeenCalledWith('task.title', 'ASC');
    });
  });

  describe('findOne', () => {
    it('returns task when found', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.findOne('task-1');

      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        relations: { project: true },
      });
      expect(result).toBe(task);
    });

    it('throws NotFoundException when not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('missing')).rejects.toThrow(
        'Task not found',
      );
    });
  });

  describe('create', () => {
    it('creates task when user owns project', async () => {
      const dto: CreateTaskDto = {
        title: 'New Task',
        projectId: 'project-1',
      };
      const project = makeProject({ userId: 'user-1' });
      const created = makeTask({ title: 'New Task' });

      projectService.findOne.mockResolvedValue(project);
      taskRepo.create.mockReturnValue(created);
      taskRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(taskRepo.create).toHaveBeenCalledWith({
        title: 'New Task',
        description: null,
        status: TaskStatus.Todo,
        projectId: 'project-1',
      });
      expect(result).toBe(created);
    });

    it('throws ForbiddenException when Member creates in another user project', async () => {
      const dto: CreateTaskDto = { title: 'New', projectId: 'project-1' };
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.create(dto, auth)).rejects.toThrow(
        ForbiddenException,
      );
      expect(taskRepo.create).not.toHaveBeenCalled();
    });

    it('allows Admin to create in any project', async () => {
      const dto: CreateTaskDto = { title: 'New', projectId: 'project-1' };
      const project = makeProject({ userId: 'other-user' });
      const created = makeTask();

      projectService.findOne.mockResolvedValue(project);
      taskRepo.create.mockReturnValue(created);
      taskRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, {
        userId: 'admin-1',
        role: UserRole.Admin,
      });

      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('updates task when user owns project', async () => {
      const task = makeTask();
      const dto: UpdateTaskDto = { title: 'Updated' };
      const project = makeProject({ userId: 'user-1' });

      taskRepo.findOne.mockResolvedValue(task);
      projectService.findOne.mockResolvedValue(project);
      taskRepo.save.mockResolvedValue({ ...task, ...dto });

      const result = await service.update('task-1', dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(taskRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws ForbiddenException when Member updates task in another user project', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(
        service.update('task-1', { title: 'Updated' }, auth),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { title: 'x' }, auth),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes task when user owns project', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'user-1' }),
      );
      taskRepo.remove.mockResolvedValue(undefined);

      await service.remove('task-1', auth);

      expect(taskRepo.remove).toHaveBeenCalledWith(task);
    });

    it('throws ForbiddenException when Member removes task in another user project', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.remove('task-1', auth)).rejects.toThrow(
        ForbiddenException,
      );
      expect(taskRepo.remove).not.toHaveBeenCalled();
    });
  });
});
