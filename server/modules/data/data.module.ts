import { Module } from '@nestjs/common';
import { ImportModule } from './import/import.module';
import { ExportModule } from './export/export.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [ImportModule, ExportModule, ReportModule],
  exports: [ImportModule, ExportModule, ReportModule],
})
export class DataModule {}
