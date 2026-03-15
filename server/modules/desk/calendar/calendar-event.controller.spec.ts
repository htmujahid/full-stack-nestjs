import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CalendarEventController } from './calendar-event.controller';
import { CalendarEventService } from './calendar-event.service';
import { CalendarEvent } from './calendar-event.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { FindCalendarEventsDto } from './dto/find-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: 'event-1',
    title: 'Meeting',
    description: null,
    startAt: new Date(),
    endAt: new Date(),
    allDay: false,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CalendarEvent;

const makeRequest = (userId: string, role: UserRole = UserRole.Member): Request =>
  ({ user: { userId, role } }) as unknown as Request;

const mockCalendarEventService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('CalendarEventController', () => {
  let controller: CalendarEventController;
  let service: ReturnType<typeof mockCalendarEventService>;

  beforeEach(async () => {
    service = mockCalendarEventService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarEventController],
      providers: [
        { provide: CalendarEventService, useValue: service },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(CalendarEventController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll(dto, auth)', async () => {
      const dto: FindCalendarEventsDto = {};
      const page = { data: [makeEvent()], total: 1, page: 1, limit: 20 };
      const req = makeRequest('user-1');

      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto, req);

      expect(service.findAll).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(page);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id)', async () => {
      const event = makeEvent();
      service.findOne.mockResolvedValue(event);

      const result = await controller.findOne('event-1');

      expect(service.findOne).toHaveBeenCalledWith('event-1');
      expect(result).toBe(event);
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Calendar event not found'),
      );

      await expect(controller.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create(dto, auth)', async () => {
      const dto: CreateCalendarEventDto = {
        title: 'New',
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T11:00:00Z',
        projectId: 'proj-1',
      };
      const event = makeEvent({ title: 'New' });
      const req = makeRequest('user-1');

      service.create.mockResolvedValue(event);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(event);
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto, auth)', async () => {
      const dto: UpdateCalendarEventDto = { title: 'Updated' };
      const updated = makeEvent({ title: 'Updated' });
      const req = makeRequest('user-1');

      service.update.mockResolvedValue(updated);

      const result = await controller.update('event-1', dto, req);

      expect(service.update).toHaveBeenCalledWith('event-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(updated);
    });

    it('propagates ForbiddenException', async () => {
      const req = makeRequest('user-1');
      service.update.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.update('event-1', { title: 'x' }, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id, auth)', async () => {
      const req = makeRequest('user-1');
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('event-1', req);

      expect(service.remove).toHaveBeenCalledWith('event-1', {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBeUndefined();
    });
  });
});
