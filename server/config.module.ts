import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './modules/identity/auth/auth.config';
import databaseConfig from './database/database.config';
import mailConfig from './common/mailer/mailer.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, mailConfig],
    }),
  ],
})
export class AppConfigModule {}
