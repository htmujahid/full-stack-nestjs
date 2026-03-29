import { Test, TestingModule } from '@nestjs/testing';
import { ImportService } from './import.service';

describe('ImportService', () => {
  let service: ImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImportService],
    }).compile();
    service = module.get(ImportService);
  });

  describe('parseCsv', () => {
    it('returns headers and rows from simple csv', () => {
      const buf = Buffer.from('a,b,c\n1,2,3\n4,5,6', 'utf-8');
      const result = service.parseCsv(buf);
      expect(result.headers).toEqual(['a', 'b', 'c']);
      expect(result.rows).toEqual([
        ['1', '2', '3'],
        ['4', '5', '6'],
      ]);
    });

    it('returns empty headers and rows for empty input', () => {
      const buf = Buffer.from('', 'utf-8');
      const result = service.parseCsv(buf);
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('returns empty rows when only headers present', () => {
      const buf = Buffer.from('a,b,c', 'utf-8');
      const result = service.parseCsv(buf);
      expect(result.headers).toEqual(['a', 'b', 'c']);
      expect(result.rows).toEqual([]);
    });

    it('handles CRLF line endings', () => {
      const buf = Buffer.from('x,y\r\n1,2', 'utf-8');
      const result = service.parseCsv(buf);
      expect(result.headers).toEqual(['x', 'y']);
      expect(result.rows).toEqual([['1', '2']]);
    });

    it('handles quoted values with commas', () => {
      const buf = Buffer.from('a,b\n"hello, world",2', 'utf-8');
      const result = service.parseCsv(buf);
      expect(result.headers).toEqual(['a', 'b']);
      expect(result.rows).toEqual([['hello, world', '2']]);
    });

    it('handles tab delimiter', () => {
      const buf = Buffer.from('a\tb\tc\n1\t2\t3', 'utf-8');
      const result = service.parseCsv(buf);
      expect(result.headers).toEqual(['a', 'b', 'c']);
      expect(result.rows).toEqual([['1', '2', '3']]);
    });
  });

  describe('preview', () => {
    describe('format csv', () => {
      it('returns preview with rowCount, columns, and up to 10 rows', () => {
        const buf = Buffer.from('title,status\nTask 1,todo\nTask 2,done', 'utf-8');
        const result = service.preview(buf, 'csv');
        expect(result.format).toBe('csv');
        expect(result.rowCount).toBe(2);
        expect(result.columns).toEqual(['title', 'status']);
        expect(result.preview).toEqual([
          { title: 'Task 1', status: 'todo' },
          { title: 'Task 2', status: 'done' },
        ]);
      });

      it('limits preview to 10 rows', () => {
        const lines = ['a,b', ...Array.from({ length: 15 }, (_, i) => `${i},${i}`)];
        const buf = Buffer.from(lines.join('\n'), 'utf-8');
        const result = service.preview(buf, 'csv');
        expect(result.rowCount).toBe(15);
        expect(result.preview).toHaveLength(10);
      });
    });

    describe('format json', () => {
      it('returns preview for array of objects', () => {
        const data = [
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ];
        const buf = Buffer.from(JSON.stringify(data), 'utf-8');
        const result = service.preview(buf, 'json');
        expect(result.format).toBe('json');
        expect(result.rowCount).toBe(2);
        expect(result.columns).toEqual(['id', 'name']);
        expect(result.preview).toEqual(data);
      });

      it('wraps single object in array', () => {
        const data = { id: '1', name: 'A' };
        const buf = Buffer.from(JSON.stringify(data), 'utf-8');
        const result = service.preview(buf, 'json');
        expect(result.rowCount).toBe(1);
        expect(result.columns).toEqual(['id', 'name']);
        expect(result.preview).toEqual([data]);
      });

      it('returns errors for invalid json', () => {
        const buf = Buffer.from('not valid json {', 'utf-8');
        const result = service.preview(buf, 'json');
        expect(result.format).toBe('json');
        expect(result.rowCount).toBe(0);
        expect(result.preview).toEqual([]);
        expect(result.errors).toEqual(['Invalid JSON']);
      });

      it('limits preview to 10 rows', () => {
        const data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
        const buf = Buffer.from(JSON.stringify(data), 'utf-8');
        const result = service.preview(buf, 'json');
        expect(result.rowCount).toBe(20);
        expect(result.preview).toHaveLength(10);
      });
    });

    it('returns errors for unsupported format', () => {
      const buf = Buffer.from('x', 'utf-8');
      const result = service.preview(buf, 'xml' as 'csv');
      expect(result.format).toBe('xml');
      expect(result.rowCount).toBe(0);
      expect(result.preview).toEqual([]);
      expect(result.errors).toContain('Unsupported format: xml');
    });
  });
});
