import { ExecutionContext } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';
import { OAUTH_REDIRECT_COOKIE, OAUTH_REDIRECT_EXPIRES_MS } from '../auth.constants';

const makeContext = (
  path: string,
  query: Record<string, string | undefined>,
  cookieFn: jest.Mock,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ path, query }),
      getResponse: () => ({ cookie: cookieFn }),
    }),
  }) as unknown as ExecutionContext;

describe('GoogleAuthGuard', () => {
  let guard: GoogleAuthGuard;

  beforeEach(() => {
    guard = new GoogleAuthGuard();
  });

  afterEach(() => jest.clearAllMocks());

  it('is instantiable', () => {
    expect(guard).toBeInstanceOf(GoogleAuthGuard);
  });

  describe('canActivate', () => {
    it('sets OAUTH_REDIRECT_COOKIE when redirectUri starts with "/" and path is not a callback', () => {
      const cookieFn = jest.fn();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(GoogleAuthGuard.prototype)), 'canActivate')
        .mockReturnValue(true);
      const ctx = makeContext('/api/auth/google', { redirectUri: '/dashboard' }, cookieFn);

      guard.canActivate(ctx);

      expect(cookieFn).toHaveBeenCalledWith(
        OAUTH_REDIRECT_COOKIE,
        '/dashboard',
        expect.objectContaining({
          httpOnly: true,
          maxAge: OAUTH_REDIRECT_EXPIRES_MS,
          path: '/',
          sameSite: 'lax',
        }),
      );

      superCanActivate.mockRestore();
    });

    it('does NOT set cookie when path ends with "/callback"', () => {
      const cookieFn = jest.fn();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(GoogleAuthGuard.prototype)), 'canActivate')
        .mockReturnValue(true);
      const ctx = makeContext('/api/auth/google/callback', { redirectUri: '/dashboard' }, cookieFn);

      guard.canActivate(ctx);

      expect(cookieFn).not.toHaveBeenCalled();

      superCanActivate.mockRestore();
    });

    it('does NOT set cookie when redirectUri is absent', () => {
      const cookieFn = jest.fn();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(GoogleAuthGuard.prototype)), 'canActivate')
        .mockReturnValue(true);
      const ctx = makeContext('/api/auth/google', {}, cookieFn);

      guard.canActivate(ctx);

      expect(cookieFn).not.toHaveBeenCalled();

      superCanActivate.mockRestore();
    });

    it('does NOT set cookie when redirectUri does not start with "/"', () => {
      const cookieFn = jest.fn();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(GoogleAuthGuard.prototype)), 'canActivate')
        .mockReturnValue(true);
      const ctx = makeContext('/api/auth/google', { redirectUri: 'https://evil.com' }, cookieFn);

      guard.canActivate(ctx);

      expect(cookieFn).not.toHaveBeenCalled();

      superCanActivate.mockRestore();
    });

    it('delegates to the passport AuthGuard base and returns its result', () => {
      const cookieFn = jest.fn();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(GoogleAuthGuard.prototype)), 'canActivate')
        .mockReturnValue(true);
      const ctx = makeContext('/api/auth/google', { redirectUri: '/dashboard' }, cookieFn);

      const result = guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
      expect(result).toBe(true);

      superCanActivate.mockRestore();
    });
  });
});
