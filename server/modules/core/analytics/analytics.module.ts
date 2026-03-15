import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from './analytics-event.entity';
import { AnalyticsService } from './analytics.service';
import { DbAnalyticsSink } from './db-analytics.sink';
import { AnalyticsController } from './analytics.controller';
import { ANALYTICS_SINKS } from './analytics.service';
import { RbacModule } from '../../identity/rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent]), RbacModule],
  controllers: [AnalyticsController],
  providers: [
    DbAnalyticsSink,
    {
      provide: ANALYTICS_SINKS,
      useFactory: (db: DbAnalyticsSink) => [db],
      inject: [DbAnalyticsSink],
    },
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
