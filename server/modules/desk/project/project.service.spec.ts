import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectService } from './project.service';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { mockRepository } from '../../../mocks/db.mock';

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

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: ReturnType<typeof mockRepository> & { findOneBy: jest.Mock };

  beforeEach(async () => {
    projectRepo = { ...mockRepository(), findOneBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    }).compile();

    service = module.get(ProjectService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns all projects from repository', async () => {
      const projects = [makeProject(), makeProject({ id: 'project-2', name: 'Second' })];
      projectRepo.find.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(projectRepo.find).toHaveBeenCalledTimes(1);
      expect(result).toBe(projects);
    });

    it('returns an empty array when no projects exist', async () => {
      projectRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
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

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns a new project', async () => {
      const dto: CreateProjectDto = { name: 'New Project', description: 'desc' };
      const createdProject = makeProject({ name: 'New Project', description: 'desc' });

      projectRepo.create.mockReturnValue(createdProject);
      projectRepo.save.mockResolvedValue(createdProject);

      const result = await service.create(dto, 'user-1');

      expect(projectRepo.create).toHaveBeenCalledWith({ ...dto, userId: 'user-1' });
      expect(projectRepo.save).toHaveBeenCalledWith(createdProject);
      expect(result).toBe(createdProject);
    });
  });

  describe('update', () => {
    it('updates and returns the project', async () => {
      const project = makeProject();
      const dto: UpdateProjectDto = { name: 'Updated Name' };
      const savedProject = makeProject({ name: 'Updated Name' });

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.save.mockResolvedValue(savedProject);

      const result = await service.update('project-1', dto);

      expect(projectRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedProject);
    });

    it('throws NotFoundException when project does not exist', async () => {
      const dto: UpdateProjectDto = { name: 'Updated' };

      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update('missing-id', dto)).rejects.toThrow(NotFoundException);
    });

    it('merges dto fields onto the project before saving', async () => {
      const project = makeProject({ name: 'Old Name', description: 'Old Desc' });
      const dto: UpdateProjectDto = { name: 'New Name' };

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.save.mockResolvedValue({ ...project, ...dto });

      await service.update('project-1', dto);

      expect(projectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
    });
  });

  describe('remove', () => {
    it('removes the project', async () => {
      const project = makeProject();

      projectRepo.findOneBy.mockResolvedValue(project);
      projectRepo.remove.mockResolvedValue(undefined);

      await service.remove('project-1');

      expect(projectRepo.remove).toHaveBeenCalledWith(project);
    });

    it('throws NotFoundException when project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
