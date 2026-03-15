import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SettingService } from './setting.service';
import { Setting, SettingType } from './setting.entity';
import { mockRepository } from '../../../mocks/db.mock';

const makeSetting = (overrides: Partial<Setting> = {}): Setting =>
  ({
    key: 'test.key',
    value: 'hello',
    type: SettingType.String,
    group: 'general',
    isPublic: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Setting;

describe('SettingService', () => {
  let service: SettingService;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    repo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingService,
        { provide: getRepositoryToken(Setting), useValue: repo },
      ],
    }).compile();

    service = module.get(SettingService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── coerce (via get) ───────────────────────────────────────────────────────

  describe('type coercion', () => {
    it('returns string as-is', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ value: 'hello', type: SettingType.String }),
      );
      expect(await service.get('k')).toBe('hello');
    });

    it('coerces number', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ value: '42', type: SettingType.Number }),
      );
      expect(await service.get('k')).toBe(42);
    });

    it('coerces boolean true', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ value: 'true', type: SettingType.Boolean }),
      );
      expect(await service.get('k')).toBe(true);
    });

    it('coerces boolean false', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ value: 'false', type: SettingType.Boolean }),
      );
      expect(await service.get('k')).toBe(false);
    });

    it('parses JSON', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ value: '{"a":1}', type: SettingType.Json }),
      );
      expect(await service.get('k')).toEqual({ a: 1 });
    });
  });

  // ─── get ────────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns null when key does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.get('missing')).toBeNull();
    });

    it('returns coerced value when key exists', async () => {
      repo.findOne.mockResolvedValue(makeSetting({ value: 'world' }));
      expect(await service.get('test.key')).toBe('world');
    });
  });

  // ─── getOrThrow ─────────────────────────────────────────────────────────────

  describe('getOrThrow', () => {
    it('throws NotFoundException when key does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getOrThrow('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns coerced value when key exists', async () => {
      repo.findOne.mockResolvedValue(
        makeSetting({ value: '7', type: SettingType.Number }),
      );
      expect(await service.getOrThrow('test.key')).toBe(7);
    });
  });

  // ─── getAll ─────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns all settings ordered by group then key', async () => {
      const settings = [makeSetting({ key: 'a' }), makeSetting({ key: 'b' })];
      repo.find.mockResolvedValue(settings);

      const result = await service.getAll();

      expect(repo.find).toHaveBeenCalledWith({
        order: { group: 'ASC', key: 'ASC' },
      });
      expect(result).toBe(settings);
    });
  });

  // ─── getPublic ──────────────────────────────────────────────────────────────

  describe('getPublic', () => {
    it('returns a key→value map of public settings', async () => {
      repo.find.mockResolvedValue([
        makeSetting({ key: 'site.name', value: 'crude', isPublic: true }),
        makeSetting({
          key: 'site.version',
          value: '2',
          type: SettingType.Number,
          isPublic: true,
        }),
      ]);

      const result = await service.getPublic();

      expect(result).toEqual({ 'site.name': 'crude', 'site.version': 2 });
    });

    it('queries only public settings', async () => {
      repo.find.mockResolvedValue([]);
      await service.getPublic();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true } }),
      );
    });
  });

  // ─── getByGroup ─────────────────────────────────────────────────────────────

  describe('getByGroup', () => {
    it('returns a key→value map for the given group', async () => {
      repo.find.mockResolvedValue([
        makeSetting({
          key: 'auth.timeout',
          value: '30',
          type: SettingType.Number,
          group: 'auth',
        }),
      ]);

      const result = await service.getByGroup('auth');

      expect(result).toEqual({ 'auth.timeout': 30 });
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { group: 'auth' } }),
      );
    });
  });

  // ─── set ────────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('creates a new record when key does not exist', async () => {
      const created = makeSetting();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue({ ...created, value: 'new' });

      await service.set('test.key', 'new');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'test.key' }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('applies meta when creating', async () => {
      const created = makeSetting();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.set('k', true, {
        type: SettingType.Boolean,
        group: 'flags',
        isPublic: true,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SettingType.Boolean,
          group: 'flags',
          isPublic: true,
        }),
      );
    });

    it('updates value on existing record', async () => {
      const existing = makeSetting({ value: 'old' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, value: '"updated"' });

      await service.set('test.key', 'updated');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'updated' }),
      );
    });

    it('merges meta onto existing record', async () => {
      const existing = makeSetting({ isPublic: false });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue(existing);

      await service.set('test.key', 'v', { isPublic: true });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true }),
      );
    });

    it('serializes objects as JSON', async () => {
      const existing = makeSetting();
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue(existing);

      await service.set('test.key', { nested: true });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ value: '{"nested":true}' }),
      );
    });
  });

  // ─── updateValue ────────────────────────────────────────────────────────────

  describe('updateValue', () => {
    it('throws NotFoundException when key does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateValue('missing', 'v')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates and saves the value', async () => {
      const existing = makeSetting({ value: 'old' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, value: 'new' });

      const result = await service.updateValue('test.key', 'new');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'new' }),
      );
      expect(result.value).toBe('new');
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws NotFoundException when no row was affected', async () => {
      repo.delete.mockResolvedValue({ affected: 0, raw: [] });
      await expect(service.delete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resolves without error when the row is deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });
      await expect(service.delete('test.key')).resolves.toBeUndefined();
    });
  });
});
