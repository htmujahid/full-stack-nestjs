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
import { CoreModule } from './api/core/core.module';
import { IdentityModule } from './api/identity/identity.module';
import { DeskModule } from './api/desk/desk.module';
import { UploadModule } from './api/misc/upload/upload.module';
import { NotificationModule } from './api/misc/notification/notification.module';
import { DataModule } from './api/data/data.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CoreModule,
    IdentityModule,
    DeskModule,
    UploadModule,
    NotificationModule,
    DataModule,
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
