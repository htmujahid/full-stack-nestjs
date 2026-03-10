import { Module } from '@nestjs/common';
import { ThrottleModule } from './throttle/throttle.module';

@Module({
  imports: [ThrottleModule],
})
export class CoreModule {}
