import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { TwoFactorModule } from './2fa/two-factor.module';
import { AccountModule } from './account/account.module';
import { CaslModule } from './rbac/casl.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    MeModule,
    TwoFactorModule,
    AccountModule,
    CaslModule,
  ],
  exports: [UserModule, AuthModule, TwoFactorModule, AccountModule, CaslModule],
})
export class IdentityModule {}
