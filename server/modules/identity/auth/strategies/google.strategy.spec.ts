import { ConfigService } from '@nestjs/config';
import type { Profile, VerifyCallback } from 'passport-google-oauth20';
import { GoogleStrategy, type GoogleProfile } from './google.strategy';

const makeConfigService = (): ConfigService =>
  ({
    getOrThrow: jest.fn().mockReturnValue('mock-value'),
  }) as unknown as ConfigService;

const makeProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({
    id: 'google-id-123',
    displayName: 'Test User',
    emails: [{ value: 'test@example.com', verified: true }],
    photos: [{ value: 'https://example.com/photo.jpg' }],
    provider: 'google',
    ...overrides,
  }) as Profile;

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    strategy = new GoogleStrategy(makeConfigService());
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    it('calls done with a GoogleProfile when email is present', () => {
      const done = jest.fn() as unknown as VerifyCallback;
      const profile = makeProfile();

      strategy.validate('access-token', 'refresh-token', profile, done);

      const expectedProfile: GoogleProfile = {
        providerId: 'google',
        accountId: 'google-id-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/photo.jpg',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      expect(done).toHaveBeenCalledWith(null, expectedProfile);
    });

    it('sets image to null when profile has no photos', () => {
      const done = jest.fn() as unknown as VerifyCallback;
      const profile = makeProfile({ photos: undefined });

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ image: null }),
      );
    });

    it('sets image to null when photos array is empty', () => {
      const done = jest.fn() as unknown as VerifyCallback;
      const profile = makeProfile({ photos: [] });

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ image: null }),
      );
    });

    it('sets refreshToken to null when refreshToken is not provided', () => {
      const done = jest.fn() as unknown as VerifyCallback;
      const profile = makeProfile();

      strategy.validate('access-token', undefined as unknown as string, profile, done);

      expect(done).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ refreshToken: null }),
      );
    });

    it('calls done with Error when no email in profile', () => {
      const done = jest.fn() as unknown as VerifyCallback;
      const profile = makeProfile({ emails: undefined });

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No email returned from Google' }),
      );
    });

    it('calls done with Error when emails array is empty', () => {
      const done = jest.fn() as unknown as VerifyCallback;
      const profile = makeProfile({ emails: [] });

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(
        expect.any(Error),
      );
    });
  });
});
