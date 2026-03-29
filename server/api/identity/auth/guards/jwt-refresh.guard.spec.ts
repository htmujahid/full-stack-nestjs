import { ExecutionContext } from '@nestjs/common';
import { JwtRefreshGuard } from './jwt-refresh.guard';

const makeContext = (): ExecutionContext =>
  ({
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn(),
  }) as unknown as ExecutionContext;

describe('JwtRefreshGuard', () => {
  let guard: JwtRefreshGuard;

  beforeEach(() => {
    guard = new JwtRefreshGuard();
  });

  afterEach(() => jest.clearAllMocks());

  it('is instantiable', () => {
    expect(guard).toBeInstanceOf(JwtRefreshGuard);
  });

  describe('canActivate', () => {
    it('delegates to super.canActivate (passport AuthGuard)', () => {
      const ctx = makeContext();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtRefreshGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
      expect(result).toBe(true);

      superCanActivate.mockRestore();
    });

    it('returns false when super.canActivate returns false', () => {
      const ctx = makeContext();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtRefreshGuard.prototype), 'canActivate')
        .mockReturnValue(false);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);

      superCanActivate.mockRestore();
    });
  });
});
