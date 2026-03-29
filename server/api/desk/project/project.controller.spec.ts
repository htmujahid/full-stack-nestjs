import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { FindProjectsDto } from './dto/find-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

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

const makeRequest = (
  userId: string,
  role: UserRole = UserRole.Member,
): Request => ({ user: { userId, role } }) as unknown as Request;

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

  beforeEach(async () => {
    service = mockProjectService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [{ provide: ProjectService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ProjectController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll(dto) and returns ProjectsPage', async () => {
      const dto: FindProjectsDto = {};
      const page = { data: [makeProject()], total: 1, page: 1, limit: 20 };
      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto);

      expect(service.findAll).toHaveBeenCalledWith(dto);
      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(page);
    });

    it('passes dto with search and userId to service', async () => {
      const dto: FindProjectsDto = {
        search: 'acme',
        userId: 'user-1',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: 2,
        limit: 10,
      };
      const page = { data: [], total: 0, page: 2, limit: 10 };
      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto);

      expect(service.findAll).toHaveBeenCalledWith(dto);
      expect(result).toEqual(page);
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
      const dto: CreateProjectDto = {
        name: 'New Project',
        description: 'desc',
      };
      const project = makeProject({ name: 'New Project' });
      const req = makeRequest('user-1');

      service.create.mockResolvedValue(project);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(result).toBe(project);
    });

    it('passes dto unchanged to service', async () => {
      const dto: CreateProjectDto = { name: 'My Project' };
      const req = makeRequest('user-42');
      service.create.mockResolvedValue(makeProject());

      await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-42');
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto, auth) with userId and role from req', async () => {
      const dto: UpdateProjectDto = { name: 'Updated Name' };
      const updatedProject = makeProject({ name: 'Updated Name' });
      const req = makeRequest('user-1', UserRole.Member);

      service.update.mockResolvedValue(updatedProject);

      const result = await controller.update('project-1', dto, req);

      expect(service.update).toHaveBeenCalledWith('project-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(updatedProject);
    });

    it('propagates NotFoundException from service when project is not found', async () => {
      const dto: UpdateProjectDto = { name: 'Updated' };
      const req = makeRequest('user-1');

      service.update.mockRejectedValue(new Error('Project not found'));

      await expect(controller.update('project-1', dto, req)).rejects.toThrow(
        'Project not found',
      );
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id, auth) with userId and role from req', async () => {
      const req = makeRequest('user-1', UserRole.Member);
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('project-1', req);

      expect(service.remove).toHaveBeenCalledWith('project-1', {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from service when project is not found', async () => {
      const req = makeRequest('user-1');

      service.remove.mockRejectedValue(new Error('Project not found'));

      await expect(controller.remove('project-1', req)).rejects.toThrow(
        'Project not found',
      );
    });
  });
});
