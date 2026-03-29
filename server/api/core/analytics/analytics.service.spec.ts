import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService, ANALYTICS_SINKS } from './analytics.service';
import type { IAnalyticsSink } from './analytics-sink.interface';

const makeSink = (): IAnalyticsSink => ({
  track: jest.fn().mockResolvedValue(undefined),
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let sinks: IAnalyticsSink[];

  beforeEach(async () => {
    sinks = [makeSink(), makeSink()];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: ANALYTICS_SINKS, useValue: sinks },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('track', () => {
    it('sends payload to all sinks when sinks are present', async () => {
      await service.track('page_view', { path: '/home' }, {
        actorId: 'u1',
        sessionId: 's1',
        tenantId: 't1',
      });

      const expectedPayload = {
        event: 'page_view',
        properties: { path: '/home' },
        actorId: 'u1',
        sessionId: 's1',
        tenantId: 't1',
      };
      expect(sinks[0].track).toHaveBeenCalledWith(expectedPayload);
      expect(sinks[1].track).toHaveBeenCalledWith(expectedPayload);
    });

    it('returns early when no sinks (does not throw)', async () => {
      const moduleNoSinks = await Test.createTestingModule({
        providers: [
          AnalyticsService,
          { provide: ANALYTICS_SINKS, useValue: [] },
        ],
      }).compile();
      const svc = moduleNoSinks.get(AnalyticsService);

      await expect(svc.track('event')).resolves.toBeUndefined();
    });

    it('uses null for optional ctx fields when not provided', async () => {
      await service.track('click');

      expect(sinks[0].track).toHaveBeenCalledWith({
        event: 'click',
        properties: null,
        actorId: null,
        sessionId: null,
        tenantId: null,
      });
    });

    it('uses null for properties when not provided', async () => {
      await service.track('event', undefined, { actorId: 'a1' });

      expect(sinks[0].track).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'event',
          properties: null,
          actorId: 'a1',
        }),
      );
    });
  });
});
