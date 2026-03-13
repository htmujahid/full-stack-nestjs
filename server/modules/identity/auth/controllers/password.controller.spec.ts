import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, CanActivate, ConflictException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PasswordController } from './password.controller';
import { PasswordService } from '../services/password.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { User } from '../../user/user.entity';
import type { Request as ExpressRequest, Response } from 'express';
import {
  TFA_PENDING_COOKIE,
  TRUST_DEVICE_COOKIE,
} from '../auth.constants';

const noopGuard: CanActivate = { canActivate: () => true };

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
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const makeTokens = () => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(),
});

const mockPasswordService = () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  forgotPassword: jest.fn(),
  validateResetPasswordToken: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
});

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
  createTrustDeviceCookieValue: jest.fn(),
});

const makeMockResponse = (): jest.Mocked<Response> =>
  ({
    cookie: jest.fn(),
    redirect: jest.fn(),
  }) as unknown as jest.Mocked<Response>;

const makeMockRequest = (
  overrides: Partial<ExpressRequest & { user: User }> = {},
): ExpressRequest & { user: User } =>
  ({
    user: makeUser(),
    cookies: {},
    ...overrides,
  }) as unknown as ExpressRequest & { user: User };

describe('PasswordController', () => {
  let controller: PasswordController;
  let passwordService: ReturnType<typeof mockPasswordService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  beforeEach(async () => {
    passwordService = mockPasswordService();
    twoFactorGate = mockTwoFactorGateService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordController],
      providers: [
        { provide: PasswordService, useValue: passwordService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(PasswordController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── signUp ─────────────────────────────────────────────────────────────────

  describe('signUp', () => {
    it('delegates to passwordService.signUp and returns { user }', async () => {
      const user = makeUser();
      passwordService.signUp.mockResolvedValue({ user });

      const result = await controller.signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(passwordService.signUp).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ user });
    });

    it('passes the full dto to passwordService.signUp', async () => {
      const user = makeUser();
      const dto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        callbackURL: 'https://app.example.com',
      };
      passwordService.signUp.mockResolvedValue({ user });

      await controller.signUp(dto);

      expect(passwordService.signUp).toHaveBeenCalledWith(dto);
    });

    it('propagates ConflictException when service throws', async () => {
      passwordService.signUp.mockRejectedValue(
        new ConflictException('User already exists. Use another email.'),
      );

      await expect(
        controller.signUp({
          name: 'Test User',
          email: 'taken@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── signIn ─────────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('returns tokens and user when 2FA is not enabled', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      passwordService.signIn.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ user });
      const res = makeMockResponse();
      const dto = { identifier: 'test@example.com', password: 'pass', rememberMe: true };

      const result = await controller.signIn(req, dto, undefined, undefined, res);

      expect(passwordService.signIn).toHaveBeenCalledWith(user, true, {
        ip: null,
        userAgent: null,
      });
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });

    it('returns { twoFactorRedirect: true } when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const req = makeMockRequest({ user, cookies: {} });
      const res = makeMockResponse();
      const dto = { identifier: 'test@example.com', password: 'pass' };

      const result = await controller.signIn(req, dto, undefined, undefined, res);

      expect(passwordService.signIn).not.toHaveBeenCalled();
      expect(result).toEqual({ twoFactorRedirect: true });
    });

    it('defaults rememberMe to true when dto.rememberMe is undefined', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      passwordService.signIn.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ user });
      const res = makeMockResponse();
      const dto = { identifier: 'test@example.com', password: 'pass' };

      await controller.signIn(req, dto, undefined, undefined, res);

      expect(passwordService.signIn).toHaveBeenCalledWith(
        user,
        true,
        expect.any(Object),
      );
    });

    it('sets rememberMe to false when dto.rememberMe is explicitly false', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      passwordService.signIn.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ user });
      const res = makeMockResponse();
      const dto = { identifier: 'test@example.com', password: 'pass', rememberMe: false };

      await controller.signIn(req, dto, undefined, undefined, res);

      expect(passwordService.signIn).toHaveBeenCalledWith(
        user,
        false,
        expect.any(Object),
      );
    });

    it('extracts the first IP from x-forwarded-for header', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      passwordService.signIn.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ user });
      const res = makeMockResponse();
      const dto = { identifier: 'test@example.com', password: 'pass' };

      await controller.signIn(req, dto, '10.0.0.1, 172.16.0.1', 'jest-agent', res);

      expect(passwordService.signIn).toHaveBeenCalledWith(
        user,
        true,
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
      );
    });

    it('propagates error when passwordService.signIn throws', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      passwordService.signIn.mockRejectedValue(new Error('Session creation failed'));

      const req = makeMockRequest({ user });
      const res = makeMockResponse();
      const dto = { identifier: 'test@example.com', password: 'pass' };

      await expect(
        controller.signIn(req, dto, undefined, undefined, res),
      ).rejects.toThrow('Session creation failed');
    });

    it('sets pending cookie when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const req = makeMockRequest({ user, cookies: {} });
      const res = makeMockResponse();

      await controller.signIn(
        req,
        { identifier: 'test@example.com', password: 'pass' },
        undefined,
        undefined,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        TFA_PENDING_COOKIE,
        'pending-jwt',
        expect.any(Object),
      );
    });

    it('rotates trust device cookie and proceeds to signIn when 2FA device is trusted', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const tokens = makeTokens();
      passwordService.signIn.mockResolvedValue({ user, tokens });
      twoFactorGate.checkTrustDevice.mockResolvedValue(true);
      twoFactorGate.rotateTrustDevice.mockResolvedValue('new-trust-cookie-value');

      const req = makeMockRequest({
        user,
        cookies: { [TRUST_DEVICE_COOKIE]: 'old-trust-value' },
      });
      const res = makeMockResponse();

      const result = await controller.signIn(
        req,
        { identifier: 'test@example.com', password: 'pass' },
        undefined,
        undefined,
        res,
      );

      expect(twoFactorGate.rotateTrustDevice).toHaveBeenCalledWith('old-trust-value', user.id);
      expect(passwordService.signIn).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ user }));
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('delegates to passwordService.forgotPassword and returns { ok: true }', async () => {
      passwordService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword({
        email: 'test@example.com',
      });

      expect(passwordService.forgotPassword).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
        undefined,
      );
      expect(result).toEqual({ ok: true });
    });

    it('passes callbackURL and errorURL to passwordService.forgotPassword', async () => {
      passwordService.forgotPassword.mockResolvedValue(undefined);

      await controller.forgotPassword({
        email: 'test@example.com',
        callbackURL: 'https://app.example.com/reset',
        errorURL: 'https://app.example.com/auth/error',
      });

      expect(passwordService.forgotPassword).toHaveBeenCalledWith(
        'test@example.com',
        'https://app.example.com/reset',
        'https://app.example.com/auth/error',
      );
    });
  });

  // ─── resetPasswordCallback ───────────────────────────────────────────────────

  describe('resetPasswordCallback', () => {
    it('returns redirect with token appended when token is valid and callbackURL is provided', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(true);

      const result = await controller.resetPasswordCallback(
        'valid-token',
        'https://app.example.com/reset',
        undefined,
      );

      expect(result).toEqual({
        url: 'https://app.example.com/reset?token=valid-token',
        statusCode: 302,
      });
    });

    it('returns redirect to errorURL with error=INVALID_TOKEN when token is invalid', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(false);

      const result = await controller.resetPasswordCallback(
        'bad-token',
        'https://app.example.com/reset',
        'https://app.example.com/auth/error',
      );

      expect(result).toEqual({
        url: 'https://app.example.com/auth/error?error=INVALID_TOKEN',
        statusCode: 302,
      });
    });

    it('returns redirect to /auth/error when errorURL missing and token is invalid', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(false);

      const result = await controller.resetPasswordCallback('bad-token', undefined, undefined);

      expect(result).toEqual({ url: '/auth/error?error=INVALID_TOKEN', statusCode: 302 });
    });

    it('returns redirect to /auth/error when callbackURL missing but token is valid', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(true);

      const result = await controller.resetPasswordCallback('valid-token', undefined, undefined);

      expect(result).toEqual({ url: '/auth/error?error=INVALID_TOKEN', statusCode: 302 });
    });

    it('uses "&" as separator when callbackURL already contains a query string', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(true);

      const result = await controller.resetPasswordCallback(
        'valid-token',
        'https://app.example.com/reset?step=2',
        undefined,
      );

      expect(result).toEqual({
        url: 'https://app.example.com/reset?step=2&token=valid-token',
        statusCode: 302,
      });
    });
  });

  // ─── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('delegates to passwordService.resetPassword and returns { ok: true }', async () => {
      passwordService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'reset-token',
        newPassword: 'new-password-123',
      });

      expect(passwordService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'new-password-123',
      );
      expect(result).toEqual({ ok: true });
    });

    it('propagates BadRequestException when service throws', async () => {
      passwordService.resetPassword.mockRejectedValue(
        new BadRequestException('Invalid or expired reset token'),
      );

      await expect(
        controller.resetPassword({ token: 'bad-token', newPassword: 'newpass' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updatePassword ──────────────────────────────────────────────────────────

  describe('updatePassword', () => {
    it('delegates to passwordService.updatePassword with userId from request and returns { ok: true }', async () => {
      passwordService.updatePassword.mockResolvedValue(undefined);

      const req = {
        user: { userId: 'user-uuid' },
      } as ExpressRequest & { user: { userId: string } };

      const result = await controller.updatePassword(req, {
        newPassword: 'updated-password',
      });

      expect(passwordService.updatePassword).toHaveBeenCalledWith(
        'user-uuid',
        'updated-password',
      );
      expect(result).toEqual({ ok: true });
    });

    it('propagates BadRequestException when service throws', async () => {
      passwordService.updatePassword.mockRejectedValue(
        new BadRequestException('No password account found'),
      );

      const req = {
        user: { userId: 'user-uuid' },
      } as ExpressRequest & { user: { userId: string } };

      await expect(
        controller.updatePassword(req, { newPassword: 'newpass' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
