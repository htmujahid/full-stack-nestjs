import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ViteMiddleware } from './common/middlewares/vite.middleware';
import appConfig from './config/configuration';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import mailConfig from './config/mail.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { CoreModule } from './modules/core/core.module';
import { IdentityModule } from './modules/identity/identity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, mailConfig],
    }),
    DatabaseModule,
    HealthModule,
    CoreModule,
    IdentityModule,
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
