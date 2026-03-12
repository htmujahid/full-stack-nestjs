import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '../../../common/mailer/mailer.module';
import { AuthModule } from '../auth/auth.module';
import { ACCESS_EXPIRES_MS } from '../auth/auth.constants';
import { TwoFactor } from './two-factor.entity';
import { User } from '../user/user.entity';
import { Account } from '../auth/entities/account.entity';
import { Verification } from '../auth/entities/verification.entity';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorPendingGuard } from './guards/two-factor-pending.guard';

@Module({
  imports: [
    AuthModule,
    MailerModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.accessSecret'),
        signOptions: { expiresIn: ACCESS_EXPIRES_MS / 1000 },
      }),
    }),
    TypeOrmModule.forFeature([TwoFactor, User, Account, Verification]),
  ],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, TwoFactorPendingGuard],
})
export class TwoFactorModule {}
