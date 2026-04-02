import { Test, TestingModule } from '@nestjs/testing';
import type { Express } from 'express';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';

const makeFile = (
  buffer: Buffer,
  mimetype: string,
): Express.Multer.File =>
  ({
    buffer,
    mimetype,
    fieldname: 'file',
    originalname: 'test.csv',
    encoding: '7bit',
    size: buffer.length,
    stream: null as unknown as import('stream').Readable,
    destination: '',
    filename: '',
    path: '',
  }) as Express.Multer.File;

const mockImportService = () => ({
  preview: jest.fn(),
});

describe('ImportController', () => {
  let controller: ImportController;
  let service: ReturnType<typeof mockImportService>;

  beforeEach(async () => {
    service = mockImportService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [{ provide: ImportService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ImportController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('preview', () => {
    it('delegates to service.preview with buffer and csv when format not provided and mimetype is text/csv', async () => {
      const buf = Buffer.from('a,b\n1,2', 'utf-8');
      const file = makeFile(buf, 'text/csv');
      const preview = { format: 'csv' as const, rowCount: 1, preview: [] };
      service.preview.mockReturnValue(preview);

      const result = await controller.preview(file);

      expect(service.preview).toHaveBeenCalledWith(buf, 'csv');
      expect(result).toBe(preview);
    });

    it('delegates to service.preview with buffer and json when format not provided and mimetype is application/json', async () => {
      const buf = Buffer.from('[]', 'utf-8');
      const file = makeFile(buf, 'application/json');
      const preview = { format: 'json' as const, rowCount: 0, preview: [] };
      service.preview.mockReturnValue(preview);

      const result = await controller.preview(file);

      expect(service.preview).toHaveBeenCalledWith(buf, 'json');
      expect(result).toBe(preview);
    });

    it('defaults to csv when mimetype is text/plain and format not provided', async () => {
      const buf = Buffer.from('a,b\n1,2', 'utf-8');
      const file = makeFile(buf, 'text/plain');
      const preview = { format: 'csv' as const, rowCount: 1, preview: [] };
      service.preview.mockReturnValue(preview);

      await controller.preview(file);

      expect(service.preview).toHaveBeenCalledWith(buf, 'csv');
    });

    it('uses explicit format when provided', async () => {
      const buf = Buffer.from('[]', 'utf-8');
      const file = makeFile(buf, 'text/csv');
      const preview = { format: 'json' as const, rowCount: 0, preview: [] };
      service.preview.mockReturnValue(preview);

      const result = await controller.preview(file, 'json');

      expect(service.preview).toHaveBeenCalledWith(buf, 'json');
      expect(result).toBe(preview);
    });
  });
});
