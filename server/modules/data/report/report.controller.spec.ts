import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

const makeRequest = (userId: string): Request =>
  ({ user: { userId, role: UserRole.Member } }) as unknown as Request;

const mockReportService = () => ({
  getSummary: jest.fn(),
});

describe('ReportController', () => {
  let controller: ReportController;
  let service: ReturnType<typeof mockReportService>;

  beforeEach(async () => {
    service = mockReportService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [{ provide: ReportService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ReportController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('summary', () => {
    it('delegates to service.getSummary with userId from req.user', async () => {
      const req = makeRequest('user-1');
      const summary = {
        projects: { total: 5 },
        tasks: { total: 12, byStatus: {} },
      };
      service.getSummary.mockResolvedValue(summary);

      const result = await controller.summary(req);

      expect(service.getSummary).toHaveBeenCalledWith('user-1');
      expect(result).toBe(summary);
    });
  });
});
