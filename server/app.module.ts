import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ViteMiddleware } from './vite.middleware.js';
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [HealthModule],
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
