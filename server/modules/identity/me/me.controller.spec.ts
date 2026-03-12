import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundError } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MeController } from './me.controller';
import { User } from '../user/user.entity';
import { mockRepository } from '../../../mocks/db.mock';
import type { Request as ExpressRequest } from 'express';

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

const makeMockRequest = (
  userId = 'user-uuid',
): ExpressRequest & { user: { userId: string } } =>
  ({
    user: { userId },
    cookies: {},
  }) as unknown as ExpressRequest & { user: { userId: string } };

describe('MeController', () => {
  let controller: MeController;
  let userRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    userRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    controller = module.get(MeController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── me ──────────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('calls userRepo.findOneOrFail with userId from request and returns user', async () => {
      const user = makeUser();
      userRepo.findOneOrFail.mockResolvedValue(user);

      const req = makeMockRequest('user-uuid');

      const result = await controller.me(req);

      expect(userRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
      });
      expect(result).toBe(user);
    });

    it('propagates error when userRepo.findOneOrFail throws', async () => {
      userRepo.findOneOrFail.mockRejectedValue(
        new EntityNotFoundError(User, { id: 'missing-uuid' }),
      );

      const req = makeMockRequest('missing-uuid');

      await expect(controller.me(req)).rejects.toThrow(EntityNotFoundError);
    });
  });

  // ─── updateMe ────────────────────────────────────────────────────────────────

  describe('updateMe', () => {
    it('skips update when dto is empty and still returns user', async () => {
      const user = makeUser();
      userRepo.findOneOrFail.mockResolvedValue(user);

      const req = makeMockRequest('user-uuid');

      const result = await controller.updateMe(req, {});

      expect(userRepo.update).not.toHaveBeenCalled();
      expect(userRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
      });
      expect(result).toBe(user);
    });

    it('calls userRepo.update when dto has fields', async () => {
      const user = makeUser({ name: 'Updated User' });
      userRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOneOrFail.mockResolvedValue(user);

      const req = makeMockRequest('user-uuid');

      await controller.updateMe(req, { name: 'Updated User' });

      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', {
        name: 'Updated User',
      });
    });

    it('returns the updated user after calling update', async () => {
      const updatedUser = makeUser({ name: 'New Name' });
      userRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOneOrFail.mockResolvedValue(updatedUser);

      const req = makeMockRequest('user-uuid');

      const result = await controller.updateMe(req, { name: 'New Name' });

      expect(result).toBe(updatedUser);
    });

    it('propagates error from findOneOrFail after update', async () => {
      userRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOneOrFail.mockRejectedValue(
        new EntityNotFoundError(User, { id: 'user-uuid' }),
      );

      const req = makeMockRequest('user-uuid');

      await expect(
        controller.updateMe(req, { name: 'Ghost User' }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });
});
