import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ViteMiddleware } from './common/middlewares/vite.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { CoreModule } from './modules/core/core.module';

@Module({
  imports: [DatabaseModule, HealthModule, CoreModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ViteMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.GET });
  }
}
