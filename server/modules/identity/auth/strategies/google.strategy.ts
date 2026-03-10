import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  providerId: string;
  accountId: string;
  email: string;
  name: string;
  image: string | null;
  accessToken: string;
  refreshToken: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('auth.googleClientId'),
      clientSecret: configService.getOrThrow<string>('auth.googleClientSecret'),
      callbackURL: `${configService.getOrThrow<string>('app.url')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No email returned from Google'));
      return;
    }

    const googleProfile: GoogleProfile = {
      providerId: 'google',
      accountId: profile.id,
      email,
      name: profile.displayName,
      image: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? null,
    };

    done(null, googleProfile);
  }
}
