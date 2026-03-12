import { Test, TestingModule } from '@nestjs/testing';
import {
  DiskHealthIndicator,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController, PermissionHealth } from './health.controller';

const mockHttpIndicator = { pingCheck: jest.fn() };
const mockDbIndicator = { pingCheck: jest.fn() };
const mockMemoryIndicator = { checkHeap: jest.fn(), checkRSS: jest.fn() };
const mockDiskIndicator = { checkStorage: jest.fn() };

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HttpHealthIndicator, useValue: mockHttpIndicator },
        { provide: TypeOrmHealthIndicator, useValue: mockDbIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryIndicator },
        { provide: DiskHealthIndicator, useValue: mockDiskIndicator },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkNetwork', () => {
    it('calls http.pingCheck with the correct key and URL', async () => {
      mockHttpIndicator.pingCheck.mockResolvedValue({ status: 'ok' });

      await controller.checkNetwork();

      expect(mockHttpIndicator.pingCheck).toHaveBeenCalledWith(
        'crude',
        'https://jsonplaceholder.typicode.com/posts',
      );
    });
  });

  describe('checkDatabase', () => {
    it('calls db.pingCheck with the correct key', async () => {
      mockDbIndicator.pingCheck.mockResolvedValue({ status: 'ok' });

      await controller.checkDatabase();

      expect(mockDbIndicator.pingCheck).toHaveBeenCalledWith(
        PermissionHealth.DB,
      );
    });
  });

  describe('checkMemoryHeap', () => {
    it('calls memory.checkHeap with 200 MB threshold', async () => {
      mockMemoryIndicator.checkHeap.mockResolvedValue({ status: 'ok' });

      await controller.checkMemoryHeap();

      expect(mockMemoryIndicator.checkHeap).toHaveBeenCalledWith(
        PermissionHealth.MH,
        200 * 1024 * 1024,
      );
    });
  });

  describe('checkMemoryRSS', () => {
    it('calls memory.checkRSS with 200 MB threshold', async () => {
      mockMemoryIndicator.checkRSS.mockResolvedValue({ status: 'ok' });

      await controller.checkMemoryRSS();

      expect(mockMemoryIndicator.checkRSS).toHaveBeenCalledWith(
        PermissionHealth.MR,
        200 * 1024 * 1024,
      );
    });
  });

  describe('checkDisk', () => {
    it('calls disk.checkStorage with 75% threshold on /', async () => {
      mockDiskIndicator.checkStorage.mockResolvedValue({ status: 'ok' });

      await controller.checkDisk();

      expect(mockDiskIndicator.checkStorage).toHaveBeenCalledWith(
        PermissionHealth.DISK,
        { thresholdPercent: 0.75, path: '/' },
      );
    });
  });
});
