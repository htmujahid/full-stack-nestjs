import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '../../../common/mailer/mailer.module';
import { ACCESS_EXPIRES_MS } from './auth.constants';
import { User } from '../user/user.entity';
import { Account } from './entities/account.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { Verification } from './entities/verification.entity';
import { AuthController } from './controllers/auth.controller';
import { EmailController } from './controllers/email.controller';
import { PasswordController } from './controllers/password.controller';
import { PhoneController } from './controllers/phone.controller';
import { GoogleController } from './controllers/google.controller';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { PasswordService } from './services/password.service';
import { PhoneService } from './services/phone.service';
import { GoogleService } from './services/google.service';
import { TwoFactorGateService } from './services/two-factor-gate.service';
import { PasswordAuthStrategy } from './strategies/password-auth.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.accessSecret'),
        signOptions: { expiresIn: ACCESS_EXPIRES_MS / 1000 },
      }),
    }),
    MailerModule,
    TypeOrmModule.forFeature([User, Account, RefreshSession, Verification]),
  ],
  controllers: [AuthController, EmailController, PasswordController, PhoneController, GoogleController],
  providers: [
    AuthService,
    EmailService,
    PasswordService,
    PhoneService,
    GoogleService,
    TwoFactorGateService,
    PasswordAuthStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
  ],
  exports: [TypeOrmModule, AuthService, TwoFactorGateService],
})
export class AuthModule {}
