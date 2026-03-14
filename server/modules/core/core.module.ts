import { Module } from '@nestjs/common';
import { ThrottleModule } from './throttle/throttle.module';
import { SettingModule } from './setting/setting.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ThrottleModule, SettingModule, HealthModule],
  exports: [SettingModule],
})
export class CoreModule {}
