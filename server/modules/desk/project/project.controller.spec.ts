import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PoliciesGuard } from '../../identity/rbac/policies.guard';

const makeProject = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 'project-1',
    name: 'Test Project',
    description: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Project;

const makeRequest = (userId: string, ability: { can: jest.Mock }): Request =>
  ({ user: { userId }, ability }) as unknown as Request;

const mockProjectService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: ReturnType<typeof mockProjectService>;
  let mockAbility: { can: jest.Mock };

  beforeEach(async () => {
    service = mockProjectService();
    mockAbility = { can: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [{ provide: ProjectService, useValue: service }],
    })
      .overrideGuard(PoliciesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ProjectController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll() and returns result', async () => {
      const projects = [makeProject()];
      service.findAll.mockResolvedValue(projects);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(projects);
    });

    it('returns an empty array when service returns none', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id) and returns result', async () => {
      const project = makeProject();
      service.findOne.mockResolvedValue(project);

      const result = await controller.findOne('project-1');

      expect(service.findOne).toHaveBeenCalledWith('project-1');
      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(result).toBe(project);
    });
  });

  describe('create', () => {
    it('extracts userId from req.user and delegates to service.create()', async () => {
      const dto: CreateProjectDto = { name: 'New Project', description: 'desc' };
      const project = makeProject({ name: 'New Project' });
      const req = makeRequest('user-1', mockAbility);

      service.create.mockResolvedValue(project);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(result).toBe(project);
    });

    it('passes dto unchanged to service', async () => {
      const dto: CreateProjectDto = { name: 'My Project' };
      const req = makeRequest('user-42', mockAbility);
      service.create.mockResolvedValue(makeProject());

      await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-42');
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto) and returns result', async () => {
      const dto: UpdateProjectDto = { name: 'Updated Name' };
      const updatedProject = makeProject({ name: 'Updated Name' });

      service.update.mockResolvedValue(updatedProject);

      const result = await controller.update('project-1', dto);

      expect(service.update).toHaveBeenCalledWith('project-1', dto);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(updatedProject);
    });

    it('propagates NotFoundException from service when project is not found', async () => {
      const dto: UpdateProjectDto = { name: 'Updated' };

      service.update.mockRejectedValue(new Error('Project not found'));

      await expect(controller.update('project-1', dto)).rejects.toThrow('Project not found');
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id) and returns undefined', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('project-1');

      expect(service.remove).toHaveBeenCalledWith('project-1');
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from service when project is not found', async () => {
      service.remove.mockRejectedValue(new Error('Project not found'));

      await expect(controller.remove('project-1')).rejects.toThrow('Project not found');
    });
  });
});
