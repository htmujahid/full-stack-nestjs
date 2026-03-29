import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { PasswordService } from './password.service';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { PhoneService } from './phone.service';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import { Account } from '../../account/account.entity';
import { Verification } from '../entities/verification.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { mockDataSource, mockRepository } from '../../../../mocks/db.mock';
import {
  CREDENTIAL_PROVIDER,
  RESET_PASSWORD_IDENTIFIER_PREFIX,
} from '../auth.constants';
import type { SignUpDto } from '../dto/sign-up.dto';

// A fixed timestamp used as the frozen "current time" across all tests.
// jest.useFakeTimers / jest.setSystemTime makes both Date.now() and new Date()
// return this value, so expiry comparisons inside the service are deterministic.
const NOW = 2_000_000_000_000; // ~2033-05-18 — safely ahead of any real clock at authoring time

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

const makeAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'account-uuid',
    userId: 'user-uuid',
    providerId: CREDENTIAL_PROVIDER,
    accountId: 'user-uuid',
    password: 'hashed-password',
    ...overrides,
  }) as Account;

const makeVerification = (
  overrides: Partial<Verification> = {},
): Verification =>
  ({
    id: 'ver-uuid',
    identifier: `${RESET_PASSWORD_IDENTIFIER_PREFIX}some-token`,
    value: 'user-uuid',
    expiresAt: new Date(NOW + 3_600_000),
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as Verification;

const makeSignUpDto = (overrides: Partial<SignUpDto> = {}): SignUpDto => ({
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  ...overrides,
});

describe('PasswordService', () => {
  let service: PasswordService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let configService: { getOrThrow: jest.Mock };
  let mailerService: { sendMail: jest.Mock };
  let emailService: { sendVerificationEmail: jest.Mock };
  let phoneService: { sendVerificationOtp: jest.Mock };
  let authService: { createAuthSession: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    configService = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    phoneService = {
      sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
    };
    authService = { createAuthSession: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: MailerService, useValue: mailerService },
        { provide: EmailService, useValue: emailService },
        { provide: PhoneService, useValue: phoneService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get(PasswordService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── signUp ─────────────────────────────────────────────────────────────────

  describe('signUp', () => {
    it('creates user and account when email is unique', async () => {
      const dto = makeSignUpDto();
      const savedUser = makeUser();
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create
        .mockReturnValueOnce(savedUser)
        .mockReturnValueOnce(makeAccount());
      txRepo.save.mockResolvedValue(savedUser);

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      const result = await service.signUp(dto);

      expect(result.user).toBe(savedUser);
      expect(txRepo.create).toHaveBeenCalledTimes(2);
      expect(txRepo.save).toHaveBeenCalledTimes(2);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('normalizes email to lowercase before checking uniqueness', async () => {
      const dto = makeSignUpDto({ email: 'TEST@EXAMPLE.COM' });
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser());
      txRepo.save.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await service.signUp(dto);

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('throws ConflictException when email already exists', async () => {
      const dto = makeSignUpDto();
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await expect(service.signUp(dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when username is already taken', async () => {
      const dto = makeSignUpDto({ username: 'taken' });
      const txRepo = mockRepository();
      // First findOne (email) returns null, second (username) returns existing user
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeUser({ username: 'taken' }));

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await expect(service.signUp(dto)).rejects.toThrow(ConflictException);
    });

    it('sets username to lowercase and trimmed when provided', async () => {
      const dto = makeSignUpDto({ username: '  MyUser  ' });
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser({ username: 'myuser' }));
      txRepo.save.mockResolvedValue(makeUser({ username: 'myuser' }));

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await service.signUp(dto);

      const createCall = txRepo.create.mock.calls[0][0] as Partial<User>;
      expect(createCall.username).toBe('myuser');
    });

    it('sends a verification email after user creation', async () => {
      const dto = makeSignUpDto({
        callbackURL: 'https://app.example.com/verify',
      });
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser());
      txRepo.save.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await service.signUp(dto);

      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'user-uuid',
        'test@example.com',
        'https://app.example.com/verify',
      );
    });

    it('skips username uniqueness check when username is not provided', async () => {
      const dto = makeSignUpDto(); // no username field
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser());
      txRepo.save.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await service.signUp(dto);

      // Only one findOne call: the email uniqueness check
      expect(txRepo.findOne).toHaveBeenCalledTimes(1);
      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
    });

    it('skips phone uniqueness check when phone is not provided', async () => {
      const dto = makeSignUpDto(); // no phone field
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser());
      txRepo.save.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await service.signUp(dto);

      expect(txRepo.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ phone: expect.anything() }),
        }),
      );
    });

    it('sets image to null when dto.image is not provided', async () => {
      const dto = makeSignUpDto(); // no image
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser({ image: null }));
      txRepo.save.mockResolvedValue(makeUser({ image: null }));

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await service.signUp(dto);

      const userCreateArg = txRepo.create.mock.calls[0][0] as Partial<User>;
      expect(userCreateArg.image).toBeNull();
    });

    it('propagates error when emailService.sendVerificationEmail throws during sign up', async () => {
      const dto = makeSignUpDto();
      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser());
      txRepo.save.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      emailService.sendVerificationEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(service.signUp(dto)).rejects.toThrow('SMTP error');
    });
  });

  // ─── signIn ─────────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('delegates to authService.createAuthSession and returns user and tokens', async () => {
      const user = makeUser();
      const tokens = {
        accessToken: 'access',
        refreshToken: 'refresh',
        refreshExpiresAt: new Date(),
      };
      authService.createAuthSession.mockResolvedValue(tokens);

      const result = await service.signIn(user, true, {
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(authService.createAuthSession).toHaveBeenCalledWith(
        user.id,
        user.role,
        true,
        { ip: '127.0.0.1', userAgent: 'jest' },
        'password',
      );
      expect(result.user).toBe(user);
      expect(result.tokens).toBe(tokens);
    });

    it('passes rememberMe=false to authService when not remembering', async () => {
      const user = makeUser();
      authService.createAuthSession.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        refreshExpiresAt: new Date(),
      });

      await service.signIn(user, false, { ip: null, userAgent: null });

      expect(authService.createAuthSession).toHaveBeenCalledWith(
        user.id,
        user.role,
        false,
        expect.any(Object),
        'password',
      );
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('saves a verification record and sends email when user exists', async () => {
      const user = makeUser();
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      configService.getOrThrow.mockReturnValue('http://localhost:3000');

      await service.forgotPassword(
        'test@example.com',
        'https://app.example.com/reset',
      );

      expect(verRepo.save).toHaveBeenCalledTimes(1);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Reset your password',
        }),
      );
    });

    it('normalizes email to lowercase before user lookup', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(userRepo);

      await service.forgotPassword('UPPER@EXAMPLE.COM');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'upper@example.com' },
      });
    });

    it('returns without sending email or saving record when user does not exist', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository
        .mockReturnValueOnce(userRepo)
        .mockReturnValueOnce(verRepo);

      await service.forgotPassword('nobody@example.com');

      expect(verRepo.save).not.toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('stores the reset token with the correct expiry', async () => {
      const user = makeUser();
      const verRepo = mockRepository();
      const created = makeVerification();
      verRepo.create.mockReturnValue(created);
      verRepo.save.mockResolvedValue(created);

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      configService.getOrThrow.mockReturnValue('http://localhost:3000');

      await service.forgotPassword('test@example.com');

      expect(verRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: user.id,
          expiresAt: new Date(NOW + 3_600_000),
        }),
      );
    });

    it('builds reset URL with base URL, token path, and encoded callbackURL', async () => {
      const user = makeUser();
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      configService.getOrThrow.mockReturnValue('http://localhost:3000');

      await service.forgotPassword(
        'test@example.com',
        'https://app.example.com/reset',
      );

      const sentMail = mailerService.sendMail.mock.calls[0][0] as {
        html: string;
      };
      expect(sentMail.html).toContain(
        'http://localhost:3000/api/auth/reset-password/',
      );
      expect(sentMail.html).toContain(
        encodeURIComponent('https://app.example.com/reset'),
      );
    });

    it('defaults callbackURL to "/" in the reset URL when not provided', async () => {
      const user = makeUser();
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      configService.getOrThrow.mockReturnValue('http://localhost:3000');

      await service.forgotPassword('test@example.com');

      const sentMail = mailerService.sendMail.mock.calls[0][0] as {
        html: string;
      };
      expect(sentMail.html).toContain(`callbackURL=${encodeURIComponent('/')}`);
    });

    it('propagates error when mailerService.sendMail throws', async () => {
      const user = makeUser();
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      configService.getOrThrow.mockReturnValue('http://localhost:3000');
      mailerService.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.forgotPassword('test@example.com')).rejects.toThrow(
        'SMTP error',
      );
    });
  });

  // ─── validateResetPasswordToken ──────────────────────────────────────────────

  describe('validateResetPasswordToken', () => {
    it('returns true when token exists and has not expired', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW + 1000) });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.validateResetPasswordToken('some-token');

      expect(result).toBe(true);
    });

    it('returns false when no record is found', async () => {
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.validateResetPasswordToken('missing-token');

      expect(result).toBe(false);
    });

    it('returns false when record exists but has expired', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW - 1) });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.validateResetPasswordToken('expired-token');

      expect(result).toBe(false);
    });

    it('queries the verification repo with the correct prefixed identifier', async () => {
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(verRepo);

      await service.validateResetPasswordToken('my-token');

      expect(verRepo.findOne).toHaveBeenCalledWith({
        where: { identifier: `${RESET_PASSWORD_IDENTIFIER_PREFIX}my-token` },
      });
    });

    it('returns true when expiresAt is exactly equal to the current time (boundary)', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW) });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.validateResetPasswordToken('boundary-token');

      expect(result).toBe(true);
    });
  });

  // ─── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('resets the password and deletes all refresh sessions on valid token', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW + 1000) });
      const account = makeAccount();

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(account);
      txAccountRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txSessionRepo = mockRepository();
      txSessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Account) return txAccountRepo;
            if (entity === RefreshSession) return txSessionRepo;
          }),
        };
        return cb(tx);
      });

      await service.resetPassword('some-token', 'new-password-123');

      expect(verRepo.delete).toHaveBeenCalledWith(record.id);
      expect(txAccountRepo.update).toHaveBeenCalledWith(
        account.id,
        expect.objectContaining({ password: expect.any(String) }),
      );
      expect(txSessionRepo.delete).toHaveBeenCalledWith({
        userId: record.value,
      });
    });

    it('throws BadRequestException on missing token', async () => {
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(
        service.resetPassword('invalid-token', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException and deletes expired record', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW - 1) });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(
        service.resetPassword('expired-token', 'newpass'),
      ).rejects.toThrow(BadRequestException);
      expect(verRepo.delete).toHaveBeenCalledWith(record.id);
    });

    it('throws BadRequestException when no credential account is found for the user', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW + 1000) });

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(verRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockReturnValue(txAccountRepo),
        };
        return cb(tx);
      });

      await expect(
        service.resetPassword('valid-token', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not enter the transaction when the token is expired', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW - 1) });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(
        service.resetPassword('expired-token', 'newpass'),
      ).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('deletes the verification record before starting the transaction', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW + 1000) });
      const account = makeAccount();

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(account);
      txAccountRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txSessionRepo = mockRepository();
      txSessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Account) return txAccountRepo;
            if (entity === RefreshSession) return txSessionRepo;
          }),
        };
        return cb(tx);
      });

      await service.resetPassword('some-token', 'new-password-123');

      expect(verRepo.delete).toHaveBeenCalledWith(record.id);
    });
  });

  // ─── updatePassword ──────────────────────────────────────────────────────────

  describe('updatePassword', () => {
    it('hashes and updates the password, then invalidates all refresh sessions', async () => {
      const account = makeAccount();

      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(account);
      txAccountRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txSessionRepo = mockRepository();
      txSessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Account) return txAccountRepo;
            if (entity === RefreshSession) return txSessionRepo;
          }),
        };
        return cb(tx);
      });

      await service.updatePassword('user-uuid', 'new-secure-pass');

      expect(txAccountRepo.update).toHaveBeenCalledWith(
        account.id,
        expect.objectContaining({ password: expect.any(String) }),
      );
      expect(txSessionRepo.delete).toHaveBeenCalledWith({
        userId: 'user-uuid',
      });
    });

    it('throws BadRequestException when the user has no credential account', async () => {
      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(null);

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockReturnValue(txAccountRepo),
        };
        return cb(tx);
      });

      await expect(
        service.updatePassword('user-uuid', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('looks up the account by userId and CREDENTIAL_PROVIDER', async () => {
      const account = makeAccount();
      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(account);
      txAccountRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txSessionRepo = mockRepository();
      txSessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Account) return txAccountRepo;
            if (entity === RefreshSession) return txSessionRepo;
          }),
        };
        return cb(tx);
      });

      await service.updatePassword('user-uuid', 'newpass');

      expect(txAccountRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', providerId: CREDENTIAL_PROVIDER },
        }),
      );
    });
  });

  // ─── addPassword ───────────────────────────────────────────────────────────

  describe('addPassword', () => {
    it('creates credential account when user has none', async () => {
      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(null);
      txAccountRepo.create.mockImplementation((dto) => dto);
      txAccountRepo.save.mockResolvedValue({});

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txAccountRepo) };
        return cb(tx);
      });

      await service.addPassword('user-uuid', 'new-secure-pass');

      expect(txAccountRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', providerId: CREDENTIAL_PROVIDER },
        }),
      );
      expect(txAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid',
          providerId: CREDENTIAL_PROVIDER,
          accountId: 'user-uuid',
        }),
      );
      expect(txAccountRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when credential account already exists', async () => {
      const txAccountRepo = mockRepository();
      txAccountRepo.findOne.mockResolvedValue(makeAccount());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txAccountRepo) };
        return cb(tx);
      });

      await expect(service.addPassword('user-uuid', 'newpass')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
