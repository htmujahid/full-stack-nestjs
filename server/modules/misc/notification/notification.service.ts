import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationStreamService } from './notification-stream.service';
import { TeamMember } from '../../identity/team/team-member.entity';

export type CreateNotificationDto = {
  type: string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NotificationsPage = {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
};

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    private readonly stream: NotificationStreamService,
  ) {}

  async create(userId: string, dto: CreateNotificationDto): Promise<Notification> {
    const n = this.repo.create({
      userId,
      type: dto.type,
      title: dto.title,
      body: dto.body ?? null,
      metadata: dto.metadata ?? null,
    });
    const saved = await this.repo.save(n);
    this.stream.push(userId, this.toPayload(saved));
    return saved;
  }

  async createForGroup(
    groupId: string,
    dto: CreateNotificationDto,
  ): Promise<Notification[]> {
    const members = await this.teamMemberRepo.find({
      where: { teamId: groupId },
      select: ['userId'],
    });
    const userIds = [...new Set(members.map((m) => m.userId))];
    const notifications: Notification[] = [];

    for (const uid of userIds) {
      const n = this.repo.create({
        userId: uid,
        groupId,
        type: dto.type,
        title: dto.title,
        body: dto.body ?? null,
        metadata: dto.metadata ?? null,
      });
      const saved = await this.repo.save(n);
      notifications.push(saved);
    }

    for (const n of notifications) {
      this.stream.push(n.userId, this.toPayload(n));
    }
    return notifications;
  }

  async findAll(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<NotificationsPage> {
    const [data, total, unreadCount] = await Promise.all([
      this.repo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.repo.count({ where: { userId } }),
      this.repo.count({ where: { userId, read: false } }),
    ]);
    return { data, total, page, limit, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.read = true;
    return this.repo.save(n);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, read: false }, { read: true });
  }

  getStream(userId: string) {
    return this.stream.getOrCreateStream(userId);
  }

  disconnectStream(userId: string): void {
    this.stream.disconnect(userId);
  }

  private toPayload(n: Notification): Record<string, unknown> {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      groupId: n.groupId,
      metadata: n.metadata,
      createdAt: n.createdAt,
    };
  }
}
