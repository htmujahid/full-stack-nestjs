import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleController } from './controllers/google.controller';
import { GoogleService } from './services/google.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuthModule } from '../auth/auth.module';
import { AccountModule } from '../account/account.module';

@Module({
  imports: [PassportModule, AuthModule, AccountModule],
  controllers: [GoogleController],
  providers: [GoogleService, GoogleStrategy],
})
export class OAuthModule {}
