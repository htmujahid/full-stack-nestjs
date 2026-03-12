import { Test, TestingModule } from '@nestjs/testing';
import { SettingController } from './setting.controller';
import { SettingService } from './setting.service';
import { Setting, SettingType } from './setting.entity';

const mockSettingService = () => ({
  getPublic: jest.fn(),
  getAll: jest.fn(),
  getOrThrow: jest.fn(),
  updateValue: jest.fn(),
});

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

describe('SettingController', () => {
  let controller: SettingController;
  let service: ReturnType<typeof mockSettingService>;

  beforeEach(async () => {
    service = mockSettingService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingController],
      providers: [{ provide: SettingService, useValue: service }],
    }).compile();

    controller = module.get(SettingController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getPublic', () => {
    it('delegates to settingService.getPublic()', async () => {
      const map = { 'site.name': 'crude' };
      service.getPublic.mockResolvedValue(map);

      const result = await controller.getPublic();

      expect(service.getPublic).toHaveBeenCalledTimes(1);
      expect(result).toBe(map);
    });
  });

  describe('getAll', () => {
    it('delegates to settingService.getAll()', async () => {
      const settings = [makeSetting()];
      service.getAll.mockResolvedValue(settings);

      const result = await controller.getAll();

      expect(service.getAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(settings);
    });
  });

  describe('getOne', () => {
    it('delegates to settingService.getOrThrow() with the correct key', async () => {
      const setting = makeSetting();
      service.getOrThrow.mockResolvedValue('hello');

      const result = await controller.getOne('test.key');

      expect(service.getOrThrow).toHaveBeenCalledWith('test.key');
      expect(result).toBe('hello');
    });
  });

  describe('update', () => {
    it('delegates to settingService.updateValue() with key and dto.value', async () => {
      const updated = makeSetting({ value: '99' });
      service.updateValue.mockResolvedValue(updated);

      const result = await controller.update('test.key', { value: 99 });

      expect(service.updateValue).toHaveBeenCalledWith('test.key', 99);
      expect(result).toBe(updated);
    });
  });
});
