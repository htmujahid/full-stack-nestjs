import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ThrottleModule } from './throttle/throttle.module';

@Module({
  imports: [ThrottleModule, UserModule, AuthModule],
  exports: [UserModule, AuthModule],
})
export class IdentityModule {}
