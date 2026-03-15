import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalendarEventService } from './calendar-event.service';
import { CalendarEvent } from './calendar-event.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { FindCalendarEventsDto } from './dto/find-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: 'event-1',
    title: 'Meeting',
    description: null,
    startAt: new Date('2024-06-01T10:00:00Z'),
    endAt: new Date('2024-06-01T11:00:00Z'),
    allDay: false,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CalendarEvent;

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'project-1',
  userId: 'user-1',
  ...overrides,
});

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

const auth = { userId: 'user-1', role: UserRole.Member } as const;

describe('CalendarEventService', () => {
  let service: CalendarEventService;
  let eventRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let projectService: { findOne: jest.Mock };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    eventRepo = {
      ...mockRepository(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    eventRepo.createQueryBuilder.mockReturnValue(qb);

    projectService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarEventService,
        { provide: getRepositoryToken(CalendarEvent), useValue: eventRepo },
        { provide: ProjectService, useValue: projectService },
      ],
    }).compile();

    service = module.get(CalendarEventService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns CalendarEventsPage with data, total, page, limit', async () => {
      const events = [makeEvent(), makeEvent({ id: 'event-2', title: 'Other' })];
      qb.getManyAndCount.mockResolvedValue([events, 2]);

      const dto: FindCalendarEventsDto = {};
      const result = await service.findAll(dto, auth);

      expect(eventRepo.createQueryBuilder).toHaveBeenCalledWith('event');
      expect(qb.orderBy).toHaveBeenCalledWith('event.startAt', 'ASC');
      expect(result).toEqual({ data: events, total: 2, page: 1, limit: 20 });
    });

    it('adds andWhere for search, projectId, startFrom, endBefore', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        {
          search: 'meeting',
          projectId: 'proj-1',
          startFrom: '2024-06-01',
          endBefore: '2024-06-30',
        },
        auth,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(event.title LIKE :search OR event.description LIKE :search)',
        { search: '%meeting%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'event.projectId = :projectId',
        { projectId: 'proj-1' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'event.endAt >= :startFrom',
        { startFrom: '2024-06-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'event.startAt <= :endBefore',
        { endBefore: '2024-06-30' },
      );
    });

    it('applies pagination and sortBy', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { page: 2, limit: 10, sortBy: 'endAt', sortOrder: 'desc' },
        auth,
      );

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.orderBy).toHaveBeenCalledWith('event.endAt', 'DESC');
    });
  });

  describe('findOne', () => {
    it('returns event when found', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);

      const result = await service.findOne('event-1');

      expect(eventRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        relations: { project: true },
      });
      expect(result).toBe(event);
    });

    it('throws NotFoundException when not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates event when user owns project', async () => {
      const dto: CreateCalendarEventDto = {
        title: 'New Event',
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T11:00:00Z',
        projectId: 'project-1',
      };
      const project = makeProject({ userId: 'user-1' });
      const created = makeEvent({ title: 'New Event' });

      projectService.findOne.mockResolvedValue(project);
      eventRepo.create.mockReturnValue(created);
      eventRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(eventRepo.create).toHaveBeenCalledWith({
        title: 'New Event',
        description: null,
        startAt: new Date('2024-06-01T10:00:00Z'),
        endAt: new Date('2024-06-01T11:00:00Z'),
        allDay: false,
        projectId: 'project-1',
      });
      expect(result).toBe(created);
    });

    it('throws ForbiddenException when Member creates in another user project', async () => {
      const dto: CreateCalendarEventDto = {
        title: 'New',
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T11:00:00Z',
        projectId: 'project-1',
      };
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.create(dto, auth)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('updates event when user owns project', async () => {
      const event = makeEvent();
      const dto: UpdateCalendarEventDto = { title: 'Updated' };
      const project = makeProject({ userId: 'user-1' });

      eventRepo.findOne.mockResolvedValue(event);
      projectService.findOne.mockResolvedValue(project);
      eventRepo.save.mockResolvedValue({ ...event, ...dto });

      const result = await service.update('event-1', dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(eventRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws ForbiddenException when Member updates in another user project', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(
        service.update('event-1', { title: 'Updated' }, auth),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('removes event when user owns project', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);
      projectService.findOne.mockResolvedValue(makeProject({ userId: 'user-1' }));
      eventRepo.remove.mockResolvedValue(undefined);

      await service.remove('event-1', auth);

      expect(eventRepo.remove).toHaveBeenCalledWith(event);
    });

    it('throws ForbiddenException when Member removes in another user project', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.remove('event-1', auth)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
