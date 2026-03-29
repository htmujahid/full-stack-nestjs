import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../../desk/task/task.entity';
import { Project } from '../../desk/project/project.entity';
import { ReportService } from './report.service';
import { mockRepository } from '../../../mocks/db.mock';
import { TaskStatus } from '../../desk/task/task-status.enum';

describe('ReportService', () => {
  let service: ReportService;
  let taskRepo: ReturnType<typeof mockRepository>;
  let projectRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    taskRepo = mockRepository();
    projectRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    }).compile();

    service = module.get(ReportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSummary', () => {
    it('returns projects total and tasks total with byStatus counts', async () => {
      projectRepo.count.mockResolvedValue(3);
      taskRepo.find.mockResolvedValue([
        { status: TaskStatus.Todo },
        { status: TaskStatus.Todo },
        { status: TaskStatus.InProgress },
        { status: TaskStatus.Done },
      ]);

      const result = await service.getSummary('user-1');

      expect(projectRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(taskRepo.find).toHaveBeenCalledWith({
        where: { project: { userId: 'user-1' } },
        select: ['status'],
      });
      expect(result).toEqual({
        projects: { total: 3 },
        tasks: {
          total: 4,
          byStatus: {
            [TaskStatus.Todo]: 2,
            [TaskStatus.InProgress]: 1,
            [TaskStatus.Done]: 1,
          },
        },
      });
    });

    it('returns zero counts when no projects or tasks', async () => {
      projectRepo.count.mockResolvedValue(0);
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getSummary('user-1');

      expect(result).toEqual({
        projects: { total: 0 },
        tasks: {
          total: 0,
          byStatus: {
            [TaskStatus.Todo]: 0,
            [TaskStatus.InProgress]: 0,
            [TaskStatus.Done]: 0,
          },
        },
      });
    });

    it('includes all TaskStatus keys in byStatus even when no tasks', async () => {
      projectRepo.count.mockResolvedValue(0);
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getSummary('user-1');

      expect(Object.keys(result.tasks.byStatus)).toEqual(
        expect.arrayContaining([
          TaskStatus.Todo,
          TaskStatus.InProgress,
          TaskStatus.Done,
        ]),
      );
    });
  });
});
