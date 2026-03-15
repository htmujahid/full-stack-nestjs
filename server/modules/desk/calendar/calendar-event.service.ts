import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { FindCalendarEventsDto } from './dto/find-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';

export type AuthContext = { userId: string; role: UserRole };

export type CalendarEventsPage = {
  data: CalendarEvent[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class CalendarEventService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepository: Repository<CalendarEvent>,
    private readonly projectService: ProjectService,
  ) {}

  async findAll(
    dto: FindCalendarEventsDto,
    _auth: AuthContext,
  ): Promise<CalendarEventsPage> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.eventRepository.createQueryBuilder('event');

    if (dto.search) {
      qb.andWhere(
        '(event.title LIKE :search OR event.description LIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    if (dto.projectId) {
      qb.andWhere('event.projectId = :projectId', {
        projectId: dto.projectId,
      });
    }

    if (dto.startFrom) {
      qb.andWhere('event.endAt >= :startFrom', {
        startFrom: dto.startFrom,
      });
    }

    if (dto.endBefore) {
      qb.andWhere('event.startAt <= :endBefore', {
        endBefore: dto.endBefore,
      });
    }

    const sortBy = dto.sortBy ?? 'startAt';
    const sortOrder = (dto.sortOrder ?? 'asc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`event.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<CalendarEvent> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: { project: true },
    });
    if (!event) throw new NotFoundException('Calendar event not found');
    return event;
  }

  async create(
    dto: CreateCalendarEventDto,
    auth: AuthContext,
  ): Promise<CalendarEvent> {
    const project = await this.projectService.findOne(dto.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    const event = this.eventRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      allDay: dto.allDay ?? false,
      projectId: dto.projectId,
    });
    return this.eventRepository.save(event);
  }

  async update(
    id: string,
    dto: UpdateCalendarEventDto,
    auth: AuthContext,
  ): Promise<CalendarEvent> {
    const event = await this.findOne(id);
    const project = await this.projectService.findOne(event.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    if (dto.startAt != null) event.startAt = new Date(dto.startAt);
    if (dto.endAt != null) event.endAt = new Date(dto.endAt);
    if (dto.title != null) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.allDay !== undefined) event.allDay = dto.allDay;
    return this.eventRepository.save(event);
  }

  async remove(id: string, auth: AuthContext): Promise<void> {
    const event = await this.findOne(id);
    const project = await this.projectService.findOne(event.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    await this.eventRepository.remove(event);
  }
}
