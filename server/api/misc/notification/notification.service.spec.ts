import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { NotificationStreamService } from './notification-stream.service';
import { TeamMember } from '../../identity/team/team-member.entity';
import { mockRepository } from '../../../mocks/db.mock';

const makeNotification = (
  overrides: Partial<Notification> = {},
): Notification =>
  ({
    id: 'notif-1',
    userId: 'user-1',
    groupId: null,
    type: 'alert',
    title: 'Test',
    body: null,
    read: false,
    metadata: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }) as Notification;

const makeTeamMember = (overrides: Partial<TeamMember> = {}): TeamMember =>
  ({
    id: 'tm-1',
    teamId: 'team-1',
    userId: 'user-1',
    joinedAt: new Date(),
    ...overrides,
  }) as TeamMember;

const mockStreamService = () => ({
  getOrCreateStream: jest.fn(),
  push: jest.fn(),
  pushToMany: jest.fn(),
  disconnect: jest.fn(),
});

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof mockRepository>;
  let teamMemberRepo: ReturnType<typeof mockRepository>;
  let stream: ReturnType<typeof mockStreamService>;

  beforeEach(async () => {
    repo = mockRepository();
    teamMemberRepo = mockRepository();
    stream = mockStreamService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: repo },
        { provide: getRepositoryToken(TeamMember), useValue: teamMemberRepo },
        { provide: NotificationStreamService, useValue: stream },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('saves to repo and pushes to stream', async () => {
      const dto = { type: 'alert', title: 'Hello', body: null, metadata: null };
      const entity = makeNotification({ userId: 'user-1', ...dto });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create('user-1', dto);

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'alert',
        title: 'Hello',
        body: null,
        metadata: null,
      });
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(stream.push).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: entity.id,
          type: 'alert',
          title: 'Hello',
          body: null,
          read: false,
          groupId: null,
          metadata: null,
          createdAt: entity.createdAt,
        }),
      );
      expect(result).toBe(entity);
    });

    it('uses body and metadata from dto when provided', async () => {
      const dto = {
        type: 'info',
        title: 'T',
        body: 'Body text',
        metadata: { key: 'val' },
      };
      const entity = makeNotification(dto);
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.create('user-1', dto);

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'info',
        title: 'T',
        body: 'Body text',
        metadata: { key: 'val' },
      });
    });
  });

  describe('createForGroup', () => {
    it('creates for each team member and pushes to each stream', async () => {
      const members = [
        makeTeamMember({ userId: 'u1' }),
        makeTeamMember({ userId: 'u2' }),
        makeTeamMember({ userId: 'u1' }),
      ];
      teamMemberRepo.find.mockResolvedValue(members);

      const n1 = makeNotification({ id: 'n1', userId: 'u1', groupId: 'team-1' });
      const n2 = makeNotification({ id: 'n2', userId: 'u2', groupId: 'team-1' });
      repo.create
        .mockReturnValueOnce(n1)
        .mockReturnValueOnce(n2);
      repo.save
        .mockResolvedValueOnce(n1)
        .mockResolvedValueOnce(n2);

      const dto = { type: 'group', title: 'Group alert', body: null, metadata: null };
      const result = await service.createForGroup('team-1', dto);

      expect(teamMemberRepo.find).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        select: ['userId'],
      });
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(stream.push).toHaveBeenCalledWith('u1', expect.any(Object));
      expect(stream.push).toHaveBeenCalledWith('u2', expect.any(Object));
      expect(stream.push).toHaveBeenCalledTimes(2);
      expect(result).toEqual([n1, n2]);
    });

    it('returns empty array when no members', async () => {
      teamMemberRepo.find.mockResolvedValue([]);

      const result = await service.createForGroup('team-1', {
        type: 'x',
        title: 'T',
        body: null,
        metadata: null,
      });

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(stream.push).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('returns paginated data with total and unreadCount', async () => {
      const data = [makeNotification(), makeNotification({ id: 'n2' })];
      repo.find.mockResolvedValue(data);
      repo.count.mockResolvedValueOnce(42).mockResolvedValueOnce(5);

      const result = await service.findAll('user-1', 2, 10);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(repo.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(repo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
      });
      expect(result).toEqual({
        data,
        total: 42,
        page: 2,
        limit: 10,
        unreadCount: 5,
      });
    });

    it('uses default page 1 and limit 20', async () => {
      repo.find.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await service.findAll('user-1');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('markRead', () => {
    it('sets read to true and saves', async () => {
      const n = makeNotification({ id: 'n1', read: false });
      repo.findOne.mockResolvedValue(n);
      repo.save.mockResolvedValue({ ...n, read: true });

      const result = await service.markRead('user-1', 'n1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'user-1' } });
      expect(n.read).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(n);
      expect(result.read).toBe(true);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.markRead('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('updates all unread for user', async () => {
      repo.update.mockResolvedValue({ affected: 3 });

      await service.markAllRead('user-1');

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-1', read: false },
        { read: true },
      );
    });
  });

  describe('getStream', () => {
    it('delegates to stream.getOrCreateStream', () => {
      const sub = {} as ReturnType<NotificationStreamService['getOrCreateStream']>;
      stream.getOrCreateStream.mockReturnValue(sub);

      const result = service.getStream('user-1');

      expect(stream.getOrCreateStream).toHaveBeenCalledWith('user-1');
      expect(result).toBe(sub);
    });
  });

  describe('disconnectStream', () => {
    it('delegates to stream.disconnect', () => {
      service.disconnectStream('user-1');

      expect(stream.disconnect).toHaveBeenCalledWith('user-1');
    });
  });
});
