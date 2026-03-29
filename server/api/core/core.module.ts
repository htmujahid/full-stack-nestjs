import { Module } from '@nestjs/common';
import { ThrottleModule } from './throttle/throttle.module';
import { SettingModule } from './setting/setting.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ThrottleModule,
    SettingModule,
    HealthModule,
    AuditModule,
    AnalyticsModule,
  ],
  exports: [SettingModule, AuditModule, AnalyticsModule],
})
export class CoreModule {}
