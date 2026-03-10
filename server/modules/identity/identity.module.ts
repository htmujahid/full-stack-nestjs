import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { ThrottleModule } from './throttle/throttle.module';

@Module({
  imports: [ThrottleModule, UserModule, AuthModule, MeModule],
  exports: [UserModule, AuthModule],
})
export class IdentityModule {}
