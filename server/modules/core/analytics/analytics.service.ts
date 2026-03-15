import { Injectable, Optional, Inject } from '@nestjs/common';
import type {
  AnalyticsEventPayload,
  IAnalyticsSink,
} from './analytics-sink.interface';

export const ANALYTICS_SINKS = 'ANALYTICS_SINKS';

@Injectable()
export class AnalyticsService {
  constructor(
    @Optional()
    @Inject(ANALYTICS_SINKS)
    private readonly sinks: IAnalyticsSink[] = [],
  ) {}

  async track(
    event: string,
    properties?: Record<string, unknown> | null,
    ctx?: Partial<
      Pick<AnalyticsEventPayload, 'actorId' | 'sessionId' | 'tenantId'>
    >,
  ): Promise<void> {
    if (this.sinks.length === 0) return;
    const payload: AnalyticsEventPayload = {
      event,
      properties: properties ?? null,
      actorId: ctx?.actorId ?? null,
      sessionId: ctx?.sessionId ?? null,
      tenantId: ctx?.tenantId ?? null,
    };
    await Promise.all(this.sinks.map((s) => s.track(payload)));
  }
}
