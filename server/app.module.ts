import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ViteMiddleware } from './common/middlewares/vite.middleware';
import { AppConfigModule } from './config.module';
import { DatabaseModule } from './database/database.module';
import { routes } from './routes';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RouterModule.register(routes),
  ],
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
