import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

const makeRequest = (userId: string): Request =>
  ({ user: { userId, role: UserRole.Member } }) as unknown as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const mockExportService = () => ({
  export: jest.fn(),
});

describe('ExportController', () => {
  let controller: ExportController;
  let service: ReturnType<typeof mockExportService>;
  let res: ReturnType<typeof mockResponse>;

  beforeEach(async () => {
    service = mockExportService();
    res = mockResponse();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ExportController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('export', () => {
    it('delegates to service.export and returns result for json format', async () => {
      const req = makeRequest('user-1');
      const data = [{ id: '1', title: 'Task' }];
      service.export.mockResolvedValue(data);

      const result = await controller.export(
        'tasks',
        'json',
        req,
        res as Response & { setHeader: jest.Mock },
      );

      expect(service.export).toHaveBeenCalledWith('tasks', 'json', 'user-1');
      expect(result).toBe(data);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('sets csv headers and returns result when format is csv', async () => {
      const req = makeRequest('user-1');
      const csvData = 'id,title\n1,Task';
      service.export.mockResolvedValue(csvData);

      const result = await controller.export(
        'tasks',
        'csv',
        req,
        res as Response & { setHeader: jest.Mock },
      );

      expect(service.export).toHaveBeenCalledWith('tasks', 'csv', 'user-1');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="tasks-export.csv"',
      );
      expect(result).toBe(csvData);
    });

    it('uses default entity tasks and format csv when query params omitted', async () => {
      const req = makeRequest('user-1');
      service.export.mockResolvedValue('');

      await controller.export(
        undefined,
        undefined,
        req,
        res as Response & { setHeader: jest.Mock },
      );

      expect(service.export).toHaveBeenCalledWith('tasks', 'csv', 'user-1');
    });

    it('exports projects with correct filename', async () => {
      const req = makeRequest('user-1');
      service.export.mockResolvedValue('id,name\n1,Proj');

      await controller.export(
        'projects',
        'csv',
        req,
        res as Response & { setHeader: jest.Mock },
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="projects-export.csv"',
      );
    });
  });
});
