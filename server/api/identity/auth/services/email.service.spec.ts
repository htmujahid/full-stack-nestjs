import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { EmailService } from './email.service';
import { AuthService } from './auth.service';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import { RefreshSession } from '../entities/refresh-session.entity';
import { mockDataSource, mockRepository } from '../../../../mocks/db.mock';
import {
  EMAIL_CHANGE_VERIFICATION_TYPE,
  EMAIL_VERIFICATION_TYPE,
  MAGIC_LINK_TYPE,
} from '../auth.constants';
import type { TokenPair } from '../types';

const NOW = 2_000_000_000_000;

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as User;

const makeTokenPair = (): TokenPair => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(NOW + 604_800_000),
});

const ctx = { ip: '127.0.0.1', userAgent: 'jest' };

describe('EmailService', () => {
  let service: EmailService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let configService: { getOrThrow: jest.Mock };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let mailerService: { sendMail: jest.Mock };
  let authService: { createAuthSession: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
      verifyAsync: jest
        .fn()
        .mockResolvedValue({
          sub: 'user-uuid',
          email: 'test@example.com',
          type: MAGIC_LINK_TYPE,
        }),
    };
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    authService = {
      createAuthSession: jest.fn().mockResolvedValue(makeTokenPair()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailerService, useValue: mailerService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── sendSignInLink ──────────────────────────────────────────────────────────

  describe('sendSignInLink', () => {
    it('sends a magic link email to the user', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser());
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.sendSignInLink('test@example.com');

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Your sign-in link',
        }),
      );
    });

    it('returns without sending email when user is not found', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.sendSignInLink('nobody@example.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase before user lookup', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.sendSignInLink('UPPER@EXAMPLE.COM');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'upper@example.com' },
      });
    });

    it('signs JWT with MAGIC_LINK_TYPE and normalized email', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(
        makeUser({ email: 'test@example.com' }),
      );
      dataSource.getRepository.mockReturnValue(userRepo);

      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendSignInLink('TEST@EXAMPLE.COM');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-uuid', email: 'test@example.com', type: MAGIC_LINK_TYPE },
        expect.any(Object),
      );
    });

    it('builds the magic link URL with the correct callback', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser());
      dataSource.getRepository.mockReturnValue(userRepo);

      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendSignInLink(
        'test@example.com',
        'https://app.example.com/dashboard',
      );

      const sentMail = mailerService.sendMail.mock.calls[0][0] as {
        html: string;
      };
      expect(sentMail.html).toContain(
        'http://localhost:3000/api/auth/verify-email-link',
      );
      expect(sentMail.html).toContain(
        encodeURIComponent('https://app.example.com/dashboard'),
      );
    });

    it('defaults callbackURL to "/" when not provided', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser());
      dataSource.getRepository.mockReturnValue(userRepo);

      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendSignInLink('test@example.com');

      const sentMail = mailerService.sendMail.mock.calls[0][0] as {
        html: string;
      };
      expect(sentMail.html).toContain(`callbackURL=${encodeURIComponent('/')}`);
    });
  });

  // ─── verifySignInLink ────────────────────────────────────────────────────────

  describe('verifySignInLink', () => {
    it('returns ok=true with user and tokens on valid magic link token', async () => {
      const user = makeUser();
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        email: 'test@example.com',
        type: MAGIC_LINK_TYPE,
      });

      const result = await service.verifySignInLink('valid-token', ctx);

      expect(result).toEqual({ ok: true, user, tokens: makeTokenPair() });
    });

    it('returns ok=false with error=invalid_token when JWT verification throws', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      const result = await service.verifySignInLink('bad-token', ctx);

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=invalid_token when type is not MAGIC_LINK_TYPE', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        email: 'test@example.com',
        type: 'wrong-type',
      });

      const result = await service.verifySignInLink('wrong-type-token', ctx);

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=invalid_token when sub is missing', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        email: 'test@example.com',
        type: MAGIC_LINK_TYPE,
      });

      const result = await service.verifySignInLink('no-sub-token', ctx);

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=user_not_found when user does not exist in DB', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'missing-user',
        email: 'test@example.com',
        type: MAGIC_LINK_TYPE,
      });

      const result = await service.verifySignInLink('valid-token', ctx);

      expect(result).toEqual({ ok: false, error: 'user_not_found' });
    });

    it('marks emailVerified=true and updates DB when user is not yet verified', async () => {
      const user = makeUser({ emailVerified: false });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        email: 'test@example.com',
        type: MAGIC_LINK_TYPE,
      });

      await service.verifySignInLink('valid-token', ctx);

      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', {
        emailVerified: true,
      });
    });

    it('skips email verification update when user is already verified', async () => {
      const user = makeUser({ emailVerified: true });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        email: 'test@example.com',
        type: MAGIC_LINK_TYPE,
      });

      await service.verifySignInLink('valid-token', ctx);

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('delegates to authService.createAuthSession with correct args', async () => {
      const user = makeUser();
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        email: 'test@example.com',
        type: MAGIC_LINK_TYPE,
      });

      await service.verifySignInLink('valid-token', ctx);

      expect(authService.createAuthSession).toHaveBeenCalledWith(
        'user-uuid',
        UserRole.Member,
        false,
        ctx,
        'email',
      );
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('returns ok=true with user and tokens on valid verification token', async () => {
      const user = makeUser();
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        email: 'test@example.com',
        type: EMAIL_VERIFICATION_TYPE,
      });

      const result = await service.verifyEmail('valid-token', ctx);

      expect(result).toEqual({ ok: true, user, tokens: makeTokenPair() });
    });

    it('returns ok=false with error=invalid_token when JWT throws', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      const result = await service.verifyEmail('bad-token', ctx);

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=invalid_token when type is wrong', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        email: 'test@example.com',
        type: 'wrong-type',
      });

      const result = await service.verifyEmail('wrong-token', ctx);

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=invalid_token when email is missing from payload', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        type: EMAIL_VERIFICATION_TYPE,
      });

      const result = await service.verifyEmail('no-email-token', ctx);

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=user_not_found when user is not in DB', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        email: 'ghost@example.com',
        type: EMAIL_VERIFICATION_TYPE,
      });

      const result = await service.verifyEmail('valid-token', ctx);

      expect(result).toEqual({ ok: false, error: 'user_not_found' });
    });

    it('marks emailVerified=true when user is not yet verified', async () => {
      const user = makeUser({ emailVerified: false });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        email: 'test@example.com',
        type: EMAIL_VERIFICATION_TYPE,
      });

      await service.verifyEmail('valid-token', ctx);

      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', {
        emailVerified: true,
      });
    });

    it('skips update when user email is already verified', async () => {
      const user = makeUser({ emailVerified: true });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        email: 'test@example.com',
        type: EMAIL_VERIFICATION_TYPE,
      });

      await service.verifyEmail('valid-token', ctx);

      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── resendVerificationEmail ─────────────────────────────────────────────────

  describe('resendVerificationEmail', () => {
    it('sends verification email when user exists and is not yet verified', async () => {
      const user = makeUser({ emailVerified: false });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.resendVerificationEmail('test@example.com');

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Verify your email' }),
      );
    });

    it('returns without sending email when user does not exist', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.resendVerificationEmail('nobody@example.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('returns without sending email when user email is already verified', async () => {
      const user = makeUser({ emailVerified: true });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.resendVerificationEmail('test@example.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase before user lookup', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.resendVerificationEmail('UPPER@EXAMPLE.COM');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'upper@example.com' },
      });
    });
  });

  // ─── initiateEmailChange ─────────────────────────────────────────────────────

  describe('initiateEmailChange', () => {
    it('sends a change verification email when new email is not taken', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      configService.getOrThrow
        .mockReturnValueOnce('my-secret')
        .mockReturnValueOnce('http://localhost:3000');

      await service.initiateEmailChange('user-uuid', 'new@example.com');

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@example.com',
          subject: 'Verify your new email address',
        }),
      );
    });

    it('throws ConflictException when new email is already in use', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(
        makeUser({ email: 'new@example.com' }),
      );
      dataSource.getRepository.mockReturnValue(userRepo);

      await expect(
        service.initiateEmailChange('user-uuid', 'new@example.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('normalizes new email to lowercase before conflict check', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      configService.getOrThrow
        .mockReturnValueOnce('my-secret')
        .mockReturnValueOnce('http://localhost:3000');

      await service.initiateEmailChange('user-uuid', 'NEW@EXAMPLE.COM');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
    });

    it('signs JWT with EMAIL_CHANGE_VERIFICATION_TYPE and normalized newEmail', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.initiateEmailChange('user-uuid', 'NEW@EXAMPLE.COM');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-uuid',
          newEmail: 'new@example.com',
          type: EMAIL_CHANGE_VERIFICATION_TYPE,
        },
        expect.any(Object),
      );
    });
  });

  // ─── verifyEmailChange ───────────────────────────────────────────────────────

  describe('verifyEmailChange', () => {
    it('returns ok=true and updates user email and invalidates sessions on valid token', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const txUserRepo = mockRepository();
      txUserRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txSessionRepo = mockRepository();
      txSessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(userRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === User) return txUserRepo;
            if (entity === RefreshSession) return txSessionRepo;
          }),
        };
        return cb(tx);
      });

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        newEmail: 'new@example.com',
        type: EMAIL_CHANGE_VERIFICATION_TYPE,
      });

      const result = await service.verifyEmailChange('valid-token');

      expect(result).toEqual({ ok: true });
      expect(txUserRepo.update).toHaveBeenCalledWith('user-uuid', {
        email: 'new@example.com',
        emailVerified: true,
      });
      expect(txSessionRepo.delete).toHaveBeenCalledWith({
        userId: 'user-uuid',
      });
    });

    it('returns ok=false with error=invalid_token when JWT throws', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      const result = await service.verifyEmailChange('bad-token');

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=invalid_token when type is wrong', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        newEmail: 'new@example.com',
        type: 'wrong-type',
      });

      const result = await service.verifyEmailChange('wrong-type-token');

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=invalid_token when sub is missing', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        newEmail: 'new@example.com',
        type: EMAIL_CHANGE_VERIFICATION_TYPE,
      });

      const result = await service.verifyEmailChange('no-sub-token');

      expect(result).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('returns ok=false with error=email_taken when new email is already in use', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(
        makeUser({ email: 'new@example.com' }),
      );
      dataSource.getRepository.mockReturnValue(userRepo);

      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        newEmail: 'new@example.com',
        type: EMAIL_CHANGE_VERIFICATION_TYPE,
      });

      const result = await service.verifyEmailChange('valid-token');

      expect(result).toEqual({ ok: false, error: 'email_taken' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ─── sendVerificationEmail ───────────────────────────────────────────────────

  describe('sendVerificationEmail', () => {
    it('sends a verification email with correct subject', async () => {
      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendVerificationEmail('user-uuid', 'test@example.com');

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Verify your email',
        }),
      );
    });

    it('signs JWT with EMAIL_VERIFICATION_TYPE payload', async () => {
      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendVerificationEmail('user-uuid', 'test@example.com');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-uuid',
          email: 'test@example.com',
          type: EMAIL_VERIFICATION_TYPE,
        },
        expect.any(Object),
      );
    });

    it('builds the verify URL with the correct callback', async () => {
      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendVerificationEmail(
        'user-uuid',
        'test@example.com',
        'https://app.example.com/callback',
      );

      const sentMail = mailerService.sendMail.mock.calls[0][0] as {
        html: string;
      };
      expect(sentMail.html).toContain(
        'http://localhost:3000/api/auth/verify-email',
      );
      expect(sentMail.html).toContain(
        encodeURIComponent('https://app.example.com/callback'),
      );
    });

    it('defaults callbackURL to "/" when not provided', async () => {
      configService.getOrThrow.mockReturnValueOnce('http://localhost:3000');

      await service.sendVerificationEmail('user-uuid', 'test@example.com');

      const sentMail = mailerService.sendMail.mock.calls[0][0] as {
        html: string;
      };
      expect(sentMail.html).toContain(`callbackURL=${encodeURIComponent('/')}`);
    });
  });
});
