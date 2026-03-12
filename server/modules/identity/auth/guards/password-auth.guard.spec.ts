import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { PasswordAuthGuard } from './password-auth.guard';

const makeContext = (body: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  }) as unknown as ExecutionContext;

describe('PasswordAuthGuard', () => {
  let guard: PasswordAuthGuard;

  beforeEach(() => {
    guard = new PasswordAuthGuard();
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('throws BadRequestException when body is missing identifier', async () => {
      const ctx = makeContext({ password: 'secret123' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when body is missing password', async () => {
      const ctx = makeContext({ identifier: 'user@example.com' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when body is empty', async () => {
      const ctx = makeContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
    });

    it('calls super.canActivate when body is valid', async () => {
      const ctx = makeContext({ identifier: 'user@example.com', password: 'secret123' });
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(PasswordAuthGuard.prototype), 'canActivate')
        .mockResolvedValue(true);

      const result = await guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
      expect(result).toBe(true);
      superCanActivate.mockRestore();
    });
  });
});
