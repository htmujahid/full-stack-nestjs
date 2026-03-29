import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';
import type {
  AnalyticsEventPayload,
  IAnalyticsSink,
} from './analytics-sink.interface';

@Injectable()
export class DbAnalyticsSink implements IAnalyticsSink {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  async track(payload: AnalyticsEventPayload): Promise<void> {
    const entity = this.repo.create({
      event: payload.event,
      properties: payload.properties ?? null,
      actorId: payload.actorId ?? null,
      sessionId: payload.sessionId ?? null,
      tenantId: payload.tenantId ?? null,
    });
    await this.repo.save(entity);
  }
}
