import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindTasksDto } from './dto/find-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './task-status.enum';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

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

const makeRequest = (userId: string, role: UserRole = UserRole.Member): Request =>
  ({ user: { userId, role } }) as unknown as Request;

const mockTaskService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('TaskController', () => {
  let controller: TaskController;
  let service: ReturnType<typeof mockTaskService>;

  beforeEach(async () => {
    service = mockTaskService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(TaskController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll(dto, auth) and returns TasksPage', async () => {
      const dto: FindTasksDto = {};
      const page = { data: [makeTask()], total: 1, page: 1, limit: 20 };
      const req = makeRequest('user-1');

      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto, req);

      expect(service.findAll).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(page);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id)', async () => {
      const task = makeTask();
      service.findOne.mockResolvedValue(task);

      const result = await controller.findOne('task-1');

      expect(service.findOne).toHaveBeenCalledWith('task-1');
      expect(result).toBe(task);
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Task not found'));

      await expect(controller.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create(dto, auth)', async () => {
      const dto: CreateTaskDto = { title: 'New', projectId: 'proj-1' };
      const task = makeTask({ title: 'New' });
      const req = makeRequest('user-1');

      service.create.mockResolvedValue(task);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(task);
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto, auth)', async () => {
      const dto: UpdateTaskDto = { title: 'Updated' };
      const updated = makeTask({ title: 'Updated' });
      const req = makeRequest('user-1');

      service.update.mockResolvedValue(updated);

      const result = await controller.update('task-1', dto, req);

      expect(service.update).toHaveBeenCalledWith('task-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(updated);
    });

    it('propagates ForbiddenException', async () => {
      const req = makeRequest('user-1');
      service.update.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.update('task-1', { title: 'x' }, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id, auth)', async () => {
      const req = makeRequest('user-1');
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('task-1', req);

      expect(service.remove).toHaveBeenCalledWith('task-1', {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBeUndefined();
    });
  });
});
