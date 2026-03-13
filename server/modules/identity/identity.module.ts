import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { TwoFactorModule } from './2fa/two-factor.module';
import { AccountModule } from './account/account.module';
import { RbacModule } from './rbac/rbac.module';
import { OAuthModule } from './oauth/oauth.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    MeModule,
    TwoFactorModule,
    AccountModule,
    RbacModule,
    OAuthModule,
  ],
  exports: [UserModule, AuthModule, TwoFactorModule, AccountModule, RbacModule, OAuthModule],
})
export class IdentityModule {}
