import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ConflictException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EmailController } from './email.controller';
import { EmailService } from '../services/email.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { JwtFreshGuard } from '../guards/jwt-fresh.guard';
import { User } from '../../user/user.entity';
import type { Request as ExpressRequest, Response } from 'express';

const noopGuard: CanActivate = { canActivate: () => true };

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: true,
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

const mockEmailService = () => ({
  sendSignInLink: jest.fn(),
  verifySignInLink: jest.fn(),
  resendVerificationEmail: jest.fn(),
  verifyEmail: jest.fn(),
  initiateEmailChange: jest.fn(),
  verifyEmailChange: jest.fn(),
});

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
  createTrustDeviceCookieValue: jest.fn(),
});

const makeMockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  }) as unknown as Response;

const makeMockRequest = (
  overrides: Partial<ExpressRequest & { user: { userId: string } }> = {},
): ExpressRequest & { user: { userId: string } } =>
  ({
    user: { userId: 'user-uuid' },
    cookies: {},
    ...overrides,
  }) as unknown as ExpressRequest & { user: { userId: string } };

describe('EmailController', () => {
  let controller: EmailController;
  let emailService: ReturnType<typeof mockEmailService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  beforeEach(async () => {
    emailService = mockEmailService();
    twoFactorGate = mockTwoFactorGateService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        { provide: EmailService, useValue: emailService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .overrideGuard(JwtFreshGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(EmailController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── sendSignInLink ──────────────────────────────────────────────────────────

  describe('sendSignInLink', () => {
    it('delegates to emailService.sendSignInLink and returns { ok: true }', async () => {
      emailService.sendSignInLink.mockResolvedValue(undefined);

      const result = await controller.sendSignInLink({
        email: 'test@example.com',
        callbackURL: '/dashboard',
      });

      expect(emailService.sendSignInLink).toHaveBeenCalledWith(
        'test@example.com',
        '/dashboard',
        undefined,
      );
      expect(result).toEqual({ ok: true });
    });

    it('passes undefined callbackURL when not provided', async () => {
      emailService.sendSignInLink.mockResolvedValue(undefined);

      await controller.sendSignInLink({ email: 'test@example.com' });

      expect(emailService.sendSignInLink).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
        undefined,
      );
    });
  });

  // ─── verifySignInLink ────────────────────────────────────────────────────────

  describe('verifySignInLink', () => {
    it('returns redirect to errorURL when service returns !ok', async () => {
      emailService.verifySignInLink.mockResolvedValue({
        ok: false,
        error: 'INVALID_TOKEN',
      });

      const req = makeMockRequest();
      const res = makeMockResponse();

      const result = await controller.verifySignInLink(
        'bad-token',
        '/dashboard',
        '/auth/error',
        undefined,
        undefined,
        res,
        req,
      );

      expect(result).toEqual({
        url: '/auth/error?error=INVALID_TOKEN',
        statusCode: 302,
      });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('returns redirect to /auth/error when errorURL not provided and service returns !ok', async () => {
      emailService.verifySignInLink.mockResolvedValue({
        ok: false,
        error: 'EXPIRED',
      });

      const req = makeMockRequest();
      const res = makeMockResponse();

      const result = await controller.verifySignInLink(
        'bad-token',
        undefined,
        undefined,
        undefined,
        undefined,
        res,
        req,
      );

      expect(result).toEqual({
        url: '/auth/error?error=EXPIRED',
        statusCode: 302,
      });
    });

    it('returns redirect to /auth/two-factor when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const tokens = makeTokens();
      emailService.verifySignInLink.mockResolvedValue({ ok: true, user, tokens });
      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      const result = await controller.verifySignInLink(
        'valid-token',
        '/dashboard',
        undefined,
        undefined,
        undefined,
        res,
        req,
      );

      expect(result).toEqual({ url: '/auth/two-factor', statusCode: 302 });
      expect(res.cookie).toHaveBeenCalledTimes(1); // pending cookie only
    });

    it('sets token cookies and returns redirect to callbackURL on success', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      emailService.verifySignInLink.mockResolvedValue({ ok: true, user, tokens });

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      const result = await controller.verifySignInLink(
        'valid-token',
        '/dashboard',
        undefined,
        undefined,
        undefined,
        res,
        req,
      );

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        url: '/dashboard',
        statusCode: 302,
      });
    });

    it('extracts first IP from x-forwarded-for header', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      emailService.verifySignInLink.mockResolvedValue({ ok: true, user, tokens });

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      await controller.verifySignInLink(
        'valid-token',
        undefined,
        undefined,
        '10.0.0.1, 172.16.0.1',
        'jest-agent',
        res,
        req,
      );

      expect(emailService.verifySignInLink).toHaveBeenCalledWith(
        'valid-token',
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
      );
    });
  });

  // ─── sendVerificationEmail ───────────────────────────────────────────────────

  describe('sendVerificationEmail', () => {
    it('delegates to emailService.resendVerificationEmail and returns { ok: true }', async () => {
      emailService.resendVerificationEmail.mockResolvedValue(undefined);

      const result = await controller.sendVerificationEmail({
        email: 'test@example.com',
        callbackURL: '/verify',
      });

      expect(emailService.resendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        '/verify',
        undefined,
      );
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('returns redirect to errorURL when service returns !ok', async () => {
      emailService.verifyEmail.mockResolvedValue({
        ok: false,
        error: 'TOKEN_EXPIRED',
      });

      const res = makeMockResponse();

      const result = await controller.verifyEmail(
        'bad-token',
        '/verify',
        undefined,
        undefined,
        undefined,
        res,
      );

      expect(result).toEqual({
        url: '/auth/error?error=TOKEN_EXPIRED',
        statusCode: 302,
      });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('sets token cookies and returns { url } on success (Redirect)', async () => {
      const user = makeUser();
      const tokens = makeTokens();
      emailService.verifyEmail.mockResolvedValue({ ok: true, user, tokens });

      const res = makeMockResponse();

      const result = await controller.verifyEmail(
        'valid-token',
        undefined,
        undefined,
        undefined,
        undefined,
        res,
      );

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ url: '/', statusCode: 302 });
    });

    it('returns { url: callbackURL } when callbackURL provided', async () => {
      const user = makeUser();
      const tokens = makeTokens();
      emailService.verifyEmail.mockResolvedValue({ ok: true, user, tokens });

      const res = makeMockResponse();

      const result = await controller.verifyEmail(
        'valid-token',
        '/dashboard',
        undefined,
        undefined,
        undefined,
        res,
      );

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ url: '/dashboard', statusCode: 302 });
    });
  });

  // ─── updateEmail ─────────────────────────────────────────────────────────────

  describe('updateEmail', () => {
    it('delegates to emailService.initiateEmailChange with userId and newEmail; returns { ok: true }', async () => {
      emailService.initiateEmailChange.mockResolvedValue(undefined);

      const req = makeMockRequest({ user: { userId: 'user-uuid' } });

      const result = await controller.updateEmail(req, {
        newEmail: 'new@example.com',
      });

      expect(emailService.initiateEmailChange).toHaveBeenCalledWith(
        'user-uuid',
        'new@example.com',
        undefined,
        undefined,
      );
      expect(result).toEqual({ ok: true });
    });

    it('propagates ConflictException when service throws', async () => {
      emailService.initiateEmailChange.mockRejectedValue(
        new ConflictException('Email already in use'),
      );

      const req = makeMockRequest({ user: { userId: 'user-uuid' } });

      await expect(
        controller.updateEmail(req, { newEmail: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── verifyEmailChange ───────────────────────────────────────────────────────

  describe('verifyEmailChange', () => {
    it('returns redirect to errorURL when service returns !ok', async () => {
      emailService.verifyEmailChange.mockResolvedValue({
        ok: false,
        error: 'INVALID_TOKEN',
      });

      const res = makeMockResponse();
      const result = await controller.verifyEmailChange(
        'bad-token',
        undefined,
        undefined,
        res,
      );

      expect(result).toEqual({
        url: '/auth/error?error=INVALID_TOKEN',
        statusCode: 302,
      });
    });

    it('returns { url, statusCode } redirect on success', async () => {
      emailService.verifyEmailChange.mockResolvedValue({ ok: true });

      const res = makeMockResponse();
      const result = await controller.verifyEmailChange(
        'valid-token',
        undefined,
        undefined,
        res,
      );

      expect(result).toEqual({ url: '/', statusCode: 302 });
    });
  });
});
