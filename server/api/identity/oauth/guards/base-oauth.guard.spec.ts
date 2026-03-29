import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { withOAuthRedirect } from './base-oauth.guard';
import {
  OAUTH_REDIRECT_COOKIE,
  OAUTH_REDIRECT_EXPIRES_MS,
} from '../../auth/auth.constants';

class MockBase {
  canActivate(_ctx: ExecutionContext): boolean | Promise<boolean> {
    return true;
  }
}

const TestGuard = withOAuthRedirect(
  MockBase as unknown as ReturnType<typeof AuthGuard>,
);

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

describe('withOAuthRedirect', () => {
  let guard: InstanceType<typeof TestGuard>;

  beforeEach(() => {
    guard = new TestGuard();
  });

  afterEach(() => jest.clearAllMocks());

  it('sets OAUTH_REDIRECT_COOKIE when redirectUri starts with "/" and path is not a callback', () => {
    const cookieFn = jest.fn();
    const ctx = makeContext(
      '/api/oauth/google',
      { redirectUri: '/dashboard' },
      cookieFn,
    );

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
  });

  it('does NOT set cookie when path ends with "/callback"', () => {
    const cookieFn = jest.fn();
    const ctx = makeContext(
      '/api/oauth/google/callback',
      { redirectUri: '/dashboard' },
      cookieFn,
    );

    guard.canActivate(ctx);

    expect(cookieFn).not.toHaveBeenCalled();
  });

  it('does NOT set cookie when redirectUri is absent', () => {
    const cookieFn = jest.fn();
    const ctx = makeContext('/api/oauth/google', {}, cookieFn);

    guard.canActivate(ctx);

    expect(cookieFn).not.toHaveBeenCalled();
  });

  it('does NOT set cookie when redirectUri does not start with "/"', () => {
    const cookieFn = jest.fn();
    const ctx = makeContext(
      '/api/oauth/google',
      { redirectUri: 'https://evil.com' },
      cookieFn,
    );

    guard.canActivate(ctx);

    expect(cookieFn).not.toHaveBeenCalled();
  });

  it('always calls super.canActivate and returns true when base returns true', () => {
    const cookieFn = jest.fn();
    const ctx = makeContext(
      '/api/oauth/google',
      { redirectUri: '/dashboard' },
      cookieFn,
    );

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('always calls super.canActivate and returns false when base returns false', () => {
    jest.spyOn(MockBase.prototype, 'canActivate').mockReturnValue(false);
    const cookieFn = jest.fn();
    const ctx = makeContext(
      '/api/oauth/google',
      { redirectUri: '/dashboard' },
      cookieFn,
    );

    const result = guard.canActivate(ctx);

    expect(result).toBe(false);

    jest.restoreAllMocks();
  });

  it('does NOT call getResponse when cookie would not be set (path is callback)', () => {
    const getResponseFn = jest.fn(() => ({ cookie: jest.fn() }));
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/oauth/google/callback',
          query: { redirectUri: '/dashboard' },
        }),
        getResponse: getResponseFn,
      }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    expect(getResponseFn).not.toHaveBeenCalled();
  });
});
