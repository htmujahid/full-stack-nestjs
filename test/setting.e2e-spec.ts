import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { SettingController } from '../server/api/core/setting/setting.controller';
import { SettingService } from '../server/api/core/setting/setting.service';
import { Setting, SettingType } from '../server/api/core/setting/setting.entity';
import { mockRepository } from '../server/mocks/db.mock';

const makeSetting = (overrides: Partial<Setting> = {}): Setting =>
  ({
    key: 'site.name',
    value: 'crude',
    type: SettingType.String,
    group: 'general',
    isPublic: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Setting;

describe('Settings (e2e)', () => {
  let app: INestApplication;
  let repo: ReturnType<typeof mockRepository>;

  beforeAll(async () => {
    repo = mockRepository();

    @Module({
      controllers: [SettingController],
      providers: [
        SettingService,
        { provide: getRepositoryToken(Setting), useValue: repo },
      ],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/settings', module: TestModule }])],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/settings/public ─────────────────────────────────────────────

  describe('GET /api/settings/public', () => {
    it('returns 200 with a key→value map of public settings', async () => {
      repo.find.mockResolvedValue([
        makeSetting({ key: 'site.name', value: 'crude', isPublic: true }),
        makeSetting({ key: 'site.version', value: '2', type: SettingType.Number, isPublic: true }),
      ]);

      const { body } = await request(app.getHttpServer())
        .get('/api/settings/public')
        .expect(200);

      expect(body).toEqual({ 'site.name': 'crude', 'site.version': 2 });
    });

    it('returns an empty object when no public settings exist', async () => {
      repo.find.mockResolvedValue([]);

      const { body } = await request(app.getHttpServer())
        .get('/api/settings/public')
        .expect(200);

      expect(body).toEqual({});
    });
  });

  // ─── GET /api/settings ────────────────────────────────────────────────────

  describe('GET /api/settings', () => {
    it('returns 200 with all settings', async () => {
      const settings = [makeSetting(), makeSetting({ key: 'other.key' })];
      repo.find.mockResolvedValue(settings);

      const { body } = await request(app.getHttpServer())
        .get('/api/settings')
        .expect(200);

      expect(body).toHaveLength(2);
      expect(body[0].key).toBe('site.name');
    });
  });

  // ─── GET /api/settings/:key ───────────────────────────────────────────────

  describe('GET /api/settings/:key', () => {
    it('returns 200 with the value for an existing key', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ key: 'site.name', value: 'crude', type: SettingType.String }),
      );

      const { text } = await request(app.getHttpServer())
        .get('/api/settings/site.name')
        .expect(200);

      expect(text).toBe('crude');
    });

    it('returns 404 when the key does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/settings/missing.key')
        .expect(404);
    });
  });

  // ─── PUT /api/settings/:key ───────────────────────────────────────────────

  describe('PUT /api/settings/:key', () => {
    it('returns 200 with the updated setting', async () => {
      const updated = makeSetting({ value: 'new-name' });
      repo.findOne.mockResolvedValue(makeSetting());
      repo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .put('/api/settings/site.name')
        .send({ value: 'new-name' })
        .expect(200);

      expect(body.value).toBe('new-name');
    });

    it('returns 404 when the key does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put('/api/settings/missing.key')
        .send({ value: 'x' })
        .expect(404);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .put('/api/settings/site.name')
        .send({})
        .expect(400);
    });
  });
});
