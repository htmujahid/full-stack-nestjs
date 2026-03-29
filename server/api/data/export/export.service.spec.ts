import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../../desk/task/task.entity';
import { Project } from '../../desk/project/project.entity';
import { ExportService } from './export.service';
import { mockRepository } from '../../../mocks/db.mock';
import { TaskStatus } from '../../desk/task/task-status.enum';

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Test Task',
  description: null,
  status: TaskStatus.Todo,
  projectId: 'project-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  ...overrides,
});

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'project-1',
  name: 'Project A',
  description: null,
  userId: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  ...overrides,
});

describe('ExportService', () => {
  let service: ExportService;
  let taskRepo: ReturnType<typeof mockRepository>;
  let projectRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    taskRepo = mockRepository();
    projectRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    }).compile();

    service = module.get(ExportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('export', () => {
    describe('entity tasks', () => {
      it('returns json when format is json', async () => {
        const tasks = [makeTask(), makeTask({ id: 'task-2', title: 'Second' })];
        taskRepo.find.mockResolvedValue(tasks);

        const result = await service.export('tasks', 'json', 'user-1');

        expect(taskRepo.find).toHaveBeenCalledWith({
          where: { project: { userId: 'user-1' } },
          relations: ['project'],
          order: { createdAt: 'DESC' },
        });
        expect(result).toEqual([
          expect.objectContaining({ id: 'task-1', title: 'Test Task' }),
          expect.objectContaining({ id: 'task-2', title: 'Second' }),
        ]);
      });

      it('returns csv string when format is csv', async () => {
        const tasks = [makeTask({ title: 'Task A', status: TaskStatus.Done })];
        taskRepo.find.mockResolvedValue(tasks);

        const result = await service.export('tasks', 'csv', 'user-1');

        expect(typeof result).toBe('string');
        expect(result).toContain('id,title,description,status');
        expect(result).toContain('Task A');
        expect(result).toContain('done');
      });
    });

    describe('entity projects', () => {
      it('returns json when format is json', async () => {
        const projects = [
          makeProject(),
          makeProject({ id: 'project-2', name: 'Project B' }),
        ];
        projectRepo.find.mockResolvedValue(projects);

        const result = await service.export('projects', 'json', 'user-1');

        expect(projectRepo.find).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          order: { createdAt: 'DESC' },
        });
        expect(result).toEqual([
          expect.objectContaining({ id: 'project-1', name: 'Project A' }),
          expect.objectContaining({ id: 'project-2', name: 'Project B' }),
        ]);
      });

      it('returns csv string when format is csv', async () => {
        const projects = [makeProject({ name: 'My Project' })];
        projectRepo.find.mockResolvedValue(projects);

        const result = await service.export('projects', 'csv', 'user-1');

        expect(typeof result).toBe('string');
        expect(result).toContain('id,name,description,userId');
        expect(result).toContain('My Project');
      });
    });

    it('returns empty csv when no rows', async () => {
      taskRepo.find.mockResolvedValue([]);

      const result = await service.export('tasks', 'csv', 'user-1');

      expect(result).toBe('');
    });

    it('escapes commas and quotes in csv', async () => {
      const tasks = [
        makeTask({ title: 'Task with, comma', description: 'Has "quotes"' }),
      ];
      taskRepo.find.mockResolvedValue(tasks);

      const result = await service.export('tasks', 'csv', 'user-1');

      expect(result).toContain('"Task with, comma"');
      expect(result).toContain('"Has ""quotes"""');
    });
  });
});
