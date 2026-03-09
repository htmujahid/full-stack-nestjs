import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    NestMailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow('mail'),
    }),
  ],
  exports: [NestMailerModule],
})
export class MailerModule {}