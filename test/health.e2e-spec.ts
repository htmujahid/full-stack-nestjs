import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, ServiceUnavailableException } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TerminusModule,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RouterModule } from '@nestjs/core';
import request from 'supertest';
import { HealthController } from '../server/api/core/health/health.controller';

const up = (key: string) => ({ [key]: { status: 'up' } });

const mockHttp = { pingCheck: jest.fn() };
const mockDb = { pingCheck: jest.fn() };
const mockMemory = { checkHeap: jest.fn(), checkRSS: jest.fn() };
const mockDisk = { checkStorage: jest.fn() };

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Module({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: HttpHealthIndicator, useValue: mockHttp },
        { provide: TypeOrmHealthIndicator, useValue: mockDb },
        { provide: MemoryHealthIndicator, useValue: mockMemory },
        { provide: DiskHealthIndicator, useValue: mockDisk },
      ],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/health', module: TestModule }])],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttp.pingCheck.mockResolvedValue(up('crude'));
    mockDb.pingCheck.mockResolvedValue(up('database'));
    mockMemory.checkHeap.mockResolvedValue(up('memory-heap'));
    mockMemory.checkRSS.mockResolvedValue(up('memory-rss'));
    mockDisk.checkStorage.mockResolvedValue(up('disk'));
  });

  // ─── network ─────────────────────────────────────────────────────────────────

  describe('GET /api/health/network', () => {
    it('returns 200 and indicator status when reachable', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/health/network')
        .expect(200);

      expect(body.crude.status).toBe('up');
    });

    it('returns 503 when network is unreachable', async () => {
      mockHttp.pingCheck.mockRejectedValue(new ServiceUnavailableException());

      await request(app.getHttpServer())
        .get('/api/health/network')
        .expect(503);
    });
  });

  // ─── database ────────────────────────────────────────────────────────────────

  describe('GET /api/health/database', () => {
    it('returns 200 and indicator status when database is reachable', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/health/database')
        .expect(200);

      expect(body.database.status).toBe('up');
    });

    it('returns 503 when database is unreachable', async () => {
      mockDb.pingCheck.mockRejectedValue(new ServiceUnavailableException());

      await request(app.getHttpServer())
        .get('/api/health/database')
        .expect(503);
    });
  });

  // ─── memory-heap ─────────────────────────────────────────────────────────────

  describe('GET /api/health/memory-heap', () => {
    it('returns 200 and indicator status when heap is within threshold', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/health/memory-heap')
        .expect(200);

      expect(body['memory-heap'].status).toBe('up');
    });

    it('returns 503 when heap exceeds threshold', async () => {
      mockMemory.checkHeap.mockRejectedValue(new ServiceUnavailableException());

      await request(app.getHttpServer())
        .get('/api/health/memory-heap')
        .expect(503);
    });
  });

  // ─── memory-rss ──────────────────────────────────────────────────────────────

  describe('GET /api/health/memory-rss', () => {
    it('returns 200 and indicator status when RSS is within threshold', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/health/memory-rss')
        .expect(200);

      expect(body['memory-rss'].status).toBe('up');
    });

    it('returns 503 when RSS exceeds threshold', async () => {
      mockMemory.checkRSS.mockRejectedValue(new ServiceUnavailableException());

      await request(app.getHttpServer())
        .get('/api/health/memory-rss')
        .expect(503);
    });
  });

  // ─── disk ────────────────────────────────────────────────────────────────────

  describe('GET /api/health/disk', () => {
    it('returns 200 and indicator status when disk is within threshold', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/health/disk')
        .expect(200);

      expect(body.disk.status).toBe('up');
    });

    it('returns 503 when disk exceeds threshold', async () => {
      mockDisk.checkStorage.mockRejectedValue(new ServiceUnavailableException());

      await request(app.getHttpServer())
        .get('/api/health/disk')
        .expect(503);
    });
  });
});
