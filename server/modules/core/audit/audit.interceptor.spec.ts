import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AUDIT_KEY } from './decorators/audit.decorator';
import { AuditAction } from './audit.entity';
import { IS_PUBLIC_KEY } from '../../identity/auth/decorators/public.decorator';

const makeAuditService = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const makeContext = (
  user: { userId: string } | undefined,
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): ExecutionContext => {
  const getRequest = jest.fn().mockReturnValue({
    user,
    params,
    headers: { 'user-agent': headers['user-agent'] ?? null, 'x-forwarded-for': headers['x-forwarded-for'] },
    socket: { remoteAddress: headers['remote'] ?? '127.0.0.1' },
  });
  const switchToHttp = jest.fn().mockReturnValue({ getRequest });
  const getHandler = jest.fn();
  const getClass = jest.fn();
  return { switchToHttp, getHandler, getClass } as unknown as ExecutionContext;
};

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: ReturnType<typeof makeAuditService>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(async () => {
    auditService = makeAuditService();
    reflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: AuditService, useValue: auditService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    interceptor = module.get(AuditInterceptor);
  });

  afterEach(() => jest.clearAllMocks());

  describe('intercept', () => {
    it('returns next.handle() without auditing when no @Audit decorator', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = makeContext({ userId: 'u1' });
      const next = { handle: jest.fn().mockReturnValue(of('result')) } as CallHandler;

      const result$ = interceptor.intercept(context, next);

      expect(next.handle).toHaveBeenCalledTimes(1);
      result$.subscribe((r) => expect(r).toBe('result'));
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('audits when @Audit decorator present and user authenticated', (done) => {
      reflector.getAllAndOverride.mockImplementation((key, targets) => {
        if (key === AUDIT_KEY) {
          return { action: AuditAction.Create, resourceType: 'user',
            resourceIdParam: 'id' };
        }
        if (key === IS_PUBLIC_KEY) return false;
        return undefined;
      });
      const context = makeContext(
        { userId: 'u1' },
        { id: 'resource-123' },
        { 'user-agent': 'TestAgent' },
      );
      const next = { handle: jest.fn().mockReturnValue(of({ id: 'resource-123', name: 'Alice' })) } as CallHandler;

      const result$ = interceptor.intercept(context, next);

      result$.subscribe({
        next: (result) => {
          expect(result).toEqual({ id: 'resource-123', name: 'Alice' });
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              actorId: 'u1',
              action: AuditAction.Create,
              resourceType: 'user',
              resourceId: 'resource-123',
              newValue: { id: 'resource-123', name: 'Alice' },
              userAgent: 'TestAgent',
            }),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('skips audit when requireAuth is true and no user (public route)', () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === AUDIT_KEY) return { action: AuditAction.Create, resourceType: 'user', requireAuth: true };
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });
      const context = makeContext(undefined);
      const next = { handle: jest.fn().mockReturnValue(of('ok')) } as CallHandler;

      interceptor.intercept(context, next).subscribe();

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('skips audit when requireAuth is true and req.user missing', () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === AUDIT_KEY) return { action: AuditAction.Create, resourceType: 'user', requireAuth: true };
        if (key === IS_PUBLIC_KEY) return false;
        return undefined;
      });
      const context = makeContext(undefined);
      const next = { handle: jest.fn().mockReturnValue(of('ok')) } as CallHandler;

      interceptor.intercept(context, next).subscribe();

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('audits when requireAuth is false even without user', (done) => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === AUDIT_KEY) return { action: AuditAction.Login, resourceType: 'session', requireAuth: false };
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });
      const context = makeContext(undefined);
      const next = { handle: jest.fn().mockReturnValue(of({ token: 'x' })) } as CallHandler;

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              actorId: null,
              action: AuditAction.Login,
              resourceType: 'session',
            }),
          );
          done();
        },
        error: done.fail,
      });
    });

    it('uses x-forwarded-for when present', (done) => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === AUDIT_KEY) return { action: AuditAction.Create, resourceType: 'user' };
        if (key === IS_PUBLIC_KEY) return false;
        return undefined;
      });
      const context = makeContext({ userId: 'u1' }, {}, { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' });
      const next = { handle: jest.fn().mockReturnValue(of({})) } as CallHandler;

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({ ip: '10.0.0.1' }),
          );
          done();
        },
        error: done.fail,
      });
    });
  });
});
