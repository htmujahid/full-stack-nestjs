import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './api/identity/auth/auth.config';
import databaseConfig from './database/database.config';
import mailConfig from './common/mailer/mailer.config';
import s3Config from './s3.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, mailConfig, s3Config],
    }),
  ],
})
export class AppConfigModule {}
