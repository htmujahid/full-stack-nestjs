import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleController } from './controllers/google.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuthModule } from '../auth/auth.module';
import { AccountModule } from '../account/account.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PassportModule, AuthModule, AccountModule, UserModule],
  controllers: [GoogleController],
  providers: [GoogleStrategy],
})
export class OAuthModule {}
