import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [UserModule, AuthModule, MeModule],
  exports: [UserModule, AuthModule],
})
export class IdentityModule {}
