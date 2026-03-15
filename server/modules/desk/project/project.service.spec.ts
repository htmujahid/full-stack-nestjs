import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectService } from './project.service';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { FindProjectsDto } from './dto/find-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserRole } from '../../identity/user/user-role.enum';
import { AuditService } from '../../core/audit/audit.service';
import { mockRepository } from '../../../mocks/db.mock';

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
  logCreate: jest.fn().mockResolvedValue(undefined),
  logUpdate: jest.fn().mockResolvedValue(undefined),
  logDelete: jest.fn().mockResolvedValue(undefined),
  logCustom: jest.fn().mockResolvedValue(undefined),
};

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

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    projectRepo = {
      ...mockRepository(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    projectRepo.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get(ProjectService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns ProjectsPage with data, total, page, limit', async () => {
      const projects = [
        makeProject(),
        makeProject({ id: 'project-2', name: 'Second' }),
      ];
      qb.getManyAndCount.mockResolvedValue([projects, 2]);

      const dto: FindProjectsDto = {};
      const result = await service.findAll(dto);

      expect(projectRepo.createQueryBuilder).toHaveBeenCalledWith('project');
      expect(qb.orderBy).toHaveBeenCalledWith('project.name', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: projects, total: 2, page: 1, limit: 20 });
    });

    it('adds andWhere for search when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'acme' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(project.name LIKE :search OR project.description LIKE :search)',
        { search: '%acme%' },
      );
    });

    it('adds andWhere for userId when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ userId: 'user-123' });

      expect(qb.andWhere).toHaveBeenCalledWith('project.userId = :userId', {
        userId: 'user-123',
      });
    });

    it('applies pagination with custom page and limit', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('applies sortBy and sortOrder', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'createdAt', sortOrder: 'desc' });

      expect(qb.orderBy).toHaveBeenCalledWith('project.createdAt', 'DESC');
    });

    it('returns empty ProjectsPage when no projects', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    });
  });

  describe('findOne', () => {
    it('returns a project when found', async () => {
      const project = makeProject();
      projectRepo.findOneBy.mockResolvedValue(project);

      const result = await service.findOne('project-1');

      expect(projectRepo.findOneBy).toHaveBeenCalledWith({ id: 'project-1' });
      expect(result).toBe(project);
    });

    it('throws NotFoundException when project is not found', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates and returns a new project', async () => {
      const dto: CreateProjectDto = {
        name: 'New Project',
        description: 'desc',
      };
      const createdProject = makeProject({
        name: 'New Project',
        description: 'desc',
      });

      projectRepo.create.mockReturnValue(createdProject);
      projectRepo.save.mockResolvedValue(createdProject);

      const result = await service.create(dto, 'user-1');

      expect(projectRepo.create).toHaveBeenCalledWith({
        ...dto,
        userId: 'user-1',
      });
      expect(projectRepo.save).toHaveBeenCalledWith(createdProject);
      expect(result).toBe(createdProject);
    });
  });

  describe('update', () => {
    it('updates and returns the project when owner', async () => {
      const project = makeProject();
      const dto: UpdateProjectDto = { name: 'Updated Name' };
      const savedProject = makeProject({ name: 'Updated Name' });

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.save.mockResolvedValue(savedProject);

      const result = await service.update('project-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });

      expect(projectRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedProject);
    });

    it('updates when Admin (bypasses ownership)', async () => {
      const project = makeProject({ userId: 'other-user' });
      const dto: UpdateProjectDto = { name: 'Updated' };
      const savedProject = makeProject({
        userId: 'other-user',
        name: 'Updated',
      });

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.save.mockResolvedValue(savedProject);

      const result = await service.update('project-1', dto, {
        userId: 'admin-1',
        role: UserRole.Admin,
      });

      expect(projectRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedProject);
    });

    it('throws ForbiddenException when Member updates another user project', async () => {
      const project = makeProject({ userId: 'other-user' });
      projectRepo.findOneBy.mockResolvedValue(project);

      await expect(
        service.update(
          'project-1',
          { name: 'Updated' },
          {
            userId: 'user-1',
            role: UserRole.Member,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when project does not exist', async () => {
      const dto: UpdateProjectDto = { name: 'Updated' };
      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', dto, {
          userId: 'user-1',
          role: UserRole.Member,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('merges dto fields onto the project before saving', async () => {
      const project = makeProject({
        name: 'Old Name',
        description: 'Old Desc',
      });
      const dto: UpdateProjectDto = { name: 'New Name' };

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.save.mockResolvedValue({ ...project, ...dto });

      await service.update('project-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });

      expect(projectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
    });
  });

  describe('remove', () => {
    it('removes the project when owner', async () => {
      const project = makeProject();

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.remove.mockResolvedValue(undefined);

      await service.remove('project-1', {
        userId: 'user-1',
        role: UserRole.Member,
      });

      expect(projectRepo.remove).toHaveBeenCalledWith(project);
    });

    it('removes when Admin (bypasses ownership)', async () => {
      const project = makeProject({ userId: 'other-user' });

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.remove.mockResolvedValue(undefined);

      await service.remove('project-1', {
        userId: 'admin-1',
        role: UserRole.Admin,
      });

      expect(projectRepo.remove).toHaveBeenCalledWith(project);
    });

    it('throws ForbiddenException when Member deletes another user project', async () => {
      const project = makeProject({ userId: 'other-user' });
      projectRepo.findOneBy.mockResolvedValue(project);

      await expect(
        service.remove('project-1', {
          userId: 'user-1',
          role: UserRole.Member,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.remove('missing-id', {
          userId: 'user-1',
          role: UserRole.Member,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
