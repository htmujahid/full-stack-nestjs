import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '../../../common/mailer/mailer.module';
import { User } from '../user/user.entity';
import { Session } from './session.entity';
import { Account } from './account.entity';
import { Verification } from './verification.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.getOrThrow('auth');
        return {
          secret: auth.secret,
          signOptions: { expiresIn: auth.verificationExpiresIn },
        };
      },
    }),
    MailerModule,
    TypeOrmModule.forFeature([
      User,
      Session,
      Account,
      Verification,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [TypeOrmModule, AuthService],
})
export class AuthModule {}
