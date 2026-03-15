import { Injectable } from '@nestjs/common';

export type ImportFormat = 'csv' | 'json';

export type ImportPreview = {
  format: ImportFormat;
  rowCount: number;
  columns?: string[];
  preview: Record<string, unknown>[];
  errors?: string[];
};

@Injectable()
export class ImportService {
  parseCsv(buffer: Buffer): { headers: string[]; rows: string[][] } {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if ((c === ',' && !inQuotes) || c === '\t') {
          result.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);
    return { headers, rows };
  }

  preview(buffer: Buffer, format: ImportFormat): ImportPreview {
    if (format === 'csv') {
      const { headers, rows } = this.parseCsv(buffer);
      const preview = rows.slice(0, 10).map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => (obj[h] = row[i] ?? null));
        return obj;
      });
      return {
        format: 'csv',
        rowCount: rows.length,
        columns: headers,
        preview,
      };
    }

    if (format === 'json') {
      let data: unknown[];
      try {
        const parsed = JSON.parse(buffer.toString('utf-8'));
        data = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return {
          format: 'json',
          rowCount: 0,
          preview: [],
          errors: ['Invalid JSON'],
        };
      }
      const sample = data[0] as Record<string, unknown> | undefined;
      const columns = sample ? Object.keys(sample) : [];
      return {
        format: 'json',
        rowCount: data.length,
        columns,
        preview: data.slice(0, 10) as Record<string, unknown>[],
      };
    }

    return {
      format,
      rowCount: 0,
      preview: [],
      errors: [`Unsupported format: ${format}`],
    };
  }
}
