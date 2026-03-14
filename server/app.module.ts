import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ViteMiddleware } from './common/middlewares/vite.middleware';
import { AppConfigModule } from './config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { CoreModule } from './modules/core/core.module';
import { IdentityModule } from './modules/identity/identity.module';
import { DeskModule } from './modules/desk/desk.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    CoreModule,
    IdentityModule,
    DeskModule,
    UploadModule,
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
