import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DbAnalyticsSink } from './db-analytics.sink';
import { AnalyticsEvent } from './analytics-event.entity';
import type { AnalyticsEventPayload } from './analytics-sink.interface';
import { mockRepository } from '../../../mocks/db.mock';

describe('DbAnalyticsSink', () => {
  let sink: DbAnalyticsSink;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    repo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbAnalyticsSink,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: repo },
      ],
    }).compile();

    sink = module.get(DbAnalyticsSink);
  });

  afterEach(() => jest.clearAllMocks());

  describe('track', () => {
    it('creates and saves entity from payload', async () => {
      const payload: AnalyticsEventPayload = {
        event: 'page_view',
        properties: { path: '/dashboard' },
        actorId: 'user-1',
        sessionId: 'sess-1',
        tenantId: 'tenant-1',
      };
      const created = { id: 'evt-1', ...payload } as AnalyticsEvent;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await sink.track(payload);

      expect(repo.create).toHaveBeenCalledWith({
        event: 'page_view',
        properties: { path: '/dashboard' },
        actorId: 'user-1',
        sessionId: 'sess-1',
        tenantId: 'tenant-1',
      });
      expect(repo.save).toHaveBeenCalledWith(created);
    });

    it('maps null for optional fields when missing', async () => {
      const payload: AnalyticsEventPayload = {
        event: 'click',
      };
      const created = {} as AnalyticsEvent;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await sink.track(payload);

      expect(repo.create).toHaveBeenCalledWith({
        event: 'click',
        properties: null,
        actorId: null,
        sessionId: null,
        tenantId: null,
      });
    });
  });
});
