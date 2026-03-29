import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { of } from 'rxjs';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

const makeRequest = (userId: string): Request =>
  ({ user: { userId, role: UserRole.Member } }) as unknown as Request;

const mockNotificationService = () => ({
  getStream: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  createForGroup: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
});

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: ReturnType<typeof mockNotificationService>;

  beforeEach(async () => {
    service = mockNotificationService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(NotificationController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('stream', () => {
    it('returns observable mapping getStream events to { data }', (done) => {
      const payload = { id: 'n1', type: 'alert', title: 'Test' };
      service.getStream.mockReturnValue(of({ data: payload }));

      const req = makeRequest('user-1');
      const result = controller.stream(req);

      result.subscribe({
        next: (ev) => {
          expect(ev).toEqual({ data: payload });
          expect(service.getStream).toHaveBeenCalledWith('user-1');
          done();
        },
      });
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with parsed page and limit', async () => {
      const page = { data: [], total: 0, page: 2, limit: 10, unreadCount: 0 };
      service.findAll.mockResolvedValue(page);

      const req = makeRequest('user-1');
      const result = await controller.findAll(req, '2', '10');

      expect(service.findAll).toHaveBeenCalledWith('user-1', 2, 10);
      expect(result).toBe(page);
    });

    it('uses default page 1 and limit 20 when query params omitted', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, unreadCount: 0 });

      await controller.findAll(makeRequest('user-1'));

      expect(service.findAll).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('create', () => {
    it('delegates to service.create with userId from req.user', async () => {
      const dto = { type: 'alert', title: 'Hello' } as CreateNotificationDto;
      const saved = { id: 'n1', userId: 'user-1', ...dto };
      service.create.mockResolvedValue(saved);

      const req = makeRequest('user-1');
      const result = await controller.create(req, dto);

      expect(service.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(saved);
    });
  });

  describe('createForGroup', () => {
    it('delegates to service.createForGroup with groupId and dto', async () => {
      const dto = { type: 'group', title: 'Group alert' } as CreateNotificationDto;
      const notifications = [{ id: 'n1', userId: 'u1', groupId: 'team-1' }];
      service.createForGroup.mockResolvedValue(notifications);

      const result = await controller.createForGroup('team-uuid-123', dto);

      expect(service.createForGroup).toHaveBeenCalledWith('team-uuid-123', dto);
      expect(result).toBe(notifications);
    });
  });

  describe('markRead', () => {
    it('delegates to service.markRead with userId and id', async () => {
      const updated = { id: 'n1', userId: 'user-1', read: true };
      service.markRead.mockResolvedValue(updated);

      const req = makeRequest('user-1');
      const result = await controller.markRead(req, 'n1');

      expect(service.markRead).toHaveBeenCalledWith('user-1', 'n1');
      expect(result).toBe(updated);
    });
  });

  describe('markAllRead', () => {
    it('delegates to service.markAllRead with userId', async () => {
      service.markAllRead.mockResolvedValue(undefined);

      const req = makeRequest('user-1');
      await controller.markAllRead(req);

      expect(service.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });
});
