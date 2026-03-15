export interface AnalyticsEventPayload {
  event: string;
  properties?: Record<string, unknown> | null;
  actorId?: string | null;
  sessionId?: string | null;
  tenantId?: string | null;
}

export interface IAnalyticsSink {
  track(payload: AnalyticsEventPayload): Promise<void>;
}
