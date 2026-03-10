import { Module } from '@nestjs/common';
import { ThrottleModule } from './throttle/throttle.module';
import { SettingModule } from './setting/setting.module';

@Module({
  imports: [ThrottleModule, SettingModule],
  exports: [SettingModule],
})
export class CoreModule {}
