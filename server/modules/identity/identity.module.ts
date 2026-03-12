import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { TwoFactorModule } from './2fa/two-factor.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [UserModule, AuthModule, MeModule, TwoFactorModule, AccountModule],
  exports: [UserModule, AuthModule, TwoFactorModule, AccountModule],
})
export class IdentityModule {}
