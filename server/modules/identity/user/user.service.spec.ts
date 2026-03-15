import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('UserService', () => {
  let service: UserService;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    repo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns UsersPage with data, total, page, limit using findAndCount', async () => {
      const users = [makeUser(), makeUser({ id: 'other-id', name: 'Second' })];
      repo.findAndCount.mockResolvedValue([users, 2]);

      const dto: FindUsersDto = {};
      const result = await service.findAll(dto);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: undefined,
        order: undefined,
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: users, total: 2, page: 1, limit: 20 });
    });

    it('returns empty UsersPage when no users exist', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    });

    it('passes search, roles, sortBy, sortOrder, page, limit to findAndCount', async () => {
      const users = [makeUser()];
      repo.findAndCount.mockResolvedValue([users, 1]);

      const dto: FindUsersDto = {
        search: 'john',
        roles: [UserRole.Admin],
        sortBy: 'name',
        sortOrder: 'desc',
        page: 2,
        limit: 10,
      };
      await service.findAll(dto);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ name: expect.anything() }),
            expect.objectContaining({ email: expect.anything() }),
            expect.objectContaining({ username: expect.anything() }),
          ]),
          order: { name: 'DESC' },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('uses role filter when roles provided without search', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ roles: [UserRole.Member, UserRole.Admin] });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: expect.anything() }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a user when found', async () => {
      const user = makeUser();
      repo.findOneBy.mockResolvedValue(user);

      const result = await service.findOne(user.id);

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: user.id });
      expect(result).toBe(user);
    });

    it('throws NotFoundException when user is not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('missing-id')).rejects.toThrow('User not found');
    });
  });

  describe('create', () => {
    it('creates and returns a new user with normalized email', async () => {
      const dto: CreateUserDto = {
        name: 'New User',
        email: 'NEW@EXAMPLE.COM',
      };
      const createdUser = makeUser({
        name: 'New User',
        email: 'new@example.com',
        role: UserRole.Member,
      });

      repo.findOneBy.mockResolvedValue(null);
      repo.create.mockReturnValue(createdUser);
      repo.save.mockResolvedValue(createdUser);

      const result = await service.create(dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({ email: 'new@example.com' });
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        email: 'new@example.com',
        role: UserRole.Member,
      });
      expect(repo.save).toHaveBeenCalledWith(createdUser);
      expect(result).toBe(createdUser);
    });

    it('uses provided role when given', async () => {
      const dto: CreateUserDto = {
        name: 'Admin User',
        email: 'admin@example.com',
        role: UserRole.Admin,
      };
      const createdUser = makeUser({ name: 'Admin User', role: UserRole.Admin });

      repo.findOneBy.mockResolvedValue(null);
      repo.create.mockReturnValue(createdUser);
      repo.save.mockResolvedValue(createdUser);

      await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.Admin }),
      );
    });

    it('checks username uniqueness when username provided', async () => {
      const dto: CreateUserDto = {
        name: 'User',
        email: 'user@example.com',
        username: 'johndoe',
      };

      repo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      repo.create.mockReturnValue(makeUser());
      repo.save.mockResolvedValue(makeUser());

      await service.create(dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(repo.findOneBy).toHaveBeenCalledWith({ username: 'johndoe' });
    });

    it('checks phone uniqueness when phone provided', async () => {
      const dto: CreateUserDto = {
        name: 'User',
        email: 'user@example.com',
        phone: '+1234567890',
      };

      repo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      repo.create.mockReturnValue(makeUser());
      repo.save.mockResolvedValue(makeUser());

      await service.create(dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({ phone: '+1234567890' });
    });

    it('throws ConflictException when email already in use', async () => {
      const dto: CreateUserDto = {
        name: 'User',
        email: 'taken@example.com',
      };
      const existing = makeUser({ email: 'taken@example.com' });

      repo.findOneBy.mockResolvedValue(existing);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Email already in use');
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when username already in use', async () => {
      const dto: CreateUserDto = {
        name: 'User',
        email: 'new@example.com',
        username: 'taken',
      };
      const existing = makeUser({ username: 'taken' });

      repo.findOneBy.mockImplementation((cond: { email?: string; username?: string }) => {
        if (cond.username === 'taken') return Promise.resolve(existing);
        return Promise.resolve(null);
      });

      const err = await service.create(dto).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toContain('Username already in use');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when phone already in use', async () => {
      const dto: CreateUserDto = {
        name: 'User',
        email: 'new@example.com',
        phone: '+1111111111',
      };
      const existing = makeUser({ phone: '+1111111111' });

      repo.findOneBy.mockImplementation((cond: { phone?: string }) => {
        if (cond.phone === '+1111111111') return Promise.resolve(existing);
        return Promise.resolve(null);
      });

      const err = await service.create(dto).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toContain('Phone already in use');
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates and returns the user', async () => {
      const user = makeUser();
      const dto: UpdateUserDto = { name: 'Updated Name' };
      const savedUser = makeUser({ name: 'Updated Name' });

      repo.findOneBy.mockResolvedValue(user);
      repo.save.mockResolvedValue(savedUser);

      const result = await service.update(user.id, dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: user.id });
      expect(repo.save).toHaveBeenCalled();
      expect(result).toBe(savedUser);
    });

    it('normalizes email to lowercase when updating email', async () => {
      const user = makeUser();
      const dto: UpdateUserDto = { email: 'UPDATED@EXAMPLE.COM' };

      repo.findOneBy.mockResolvedValue(user);
      repo.save.mockResolvedValue({ ...user, email: 'updated@example.com' });

      await service.update(user.id, dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: 'updated@example.com',
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'updated@example.com' }),
      );
    });

    it('checks email uniqueness excluding current user id', async () => {
      const user = makeUser({ id: 'user-1' });
      const dto: UpdateUserDto = { email: 'new@example.com' };
      const otherUser = makeUser({ id: 'other-id', email: 'new@example.com' });

      repo.findOneBy
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(otherUser);

      await expect(service.update('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows same user to keep their email (no conflict)', async () => {
      const user = makeUser({ email: 'same@example.com' });
      const dto: UpdateUserDto = { name: 'New Name' };

      repo.findOneBy.mockResolvedValue(user);
      repo.save.mockResolvedValue({ ...user, name: 'New Name' });

      const result = await service.update(user.id, dto);

      expect(result).toBeDefined();
      expect(repo.save).toHaveBeenCalled();
    });

    it('checks username uniqueness when username provided', async () => {
      const user = makeUser({ id: 'user-1' });
      const dto: UpdateUserDto = { username: 'taken' };
      const otherUser = makeUser({ id: 'other-id', username: 'taken' });

      repo.findOneBy.mockImplementation(
        (cond: { id?: string; username?: string }) => {
          if (cond.id === 'user-1') return Promise.resolve(user);
          if (cond.username === 'taken') return Promise.resolve(otherUser);
          return Promise.resolve(null);
        },
      );

      const err = await service.update('user-1', dto).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toContain('Username already in use');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('checks phone uniqueness when phone provided', async () => {
      const user = makeUser({ id: 'user-1' });
      const dto: UpdateUserDto = { phone: '+9999999999' };
      const otherUser = makeUser({ id: 'other-id', phone: '+9999999999' });

      repo.findOneBy.mockImplementation(
        (cond: { id?: string; phone?: string }) => {
          if (cond.id === 'user-1') return Promise.resolve(user);
          if (cond.phone === '+9999999999') return Promise.resolve(otherUser);
          return Promise.resolve(null);
        },
      );

      const err = await service.update('user-1', dto).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toContain('Phone already in use');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does not check username when username is null in dto', async () => {
      const user = makeUser();
      const dto: UpdateUserDto = { name: 'Updated', username: null };

      repo.findOneBy.mockResolvedValue(user);
      repo.save.mockResolvedValue({ ...user, ...dto });

      await service.update(user.id, dto);

      expect(repo.findOneBy).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the user', async () => {
      const user = makeUser();

      repo.findOneBy.mockResolvedValue(user);
      repo.remove.mockResolvedValue(undefined);

      await service.remove(user.id);

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: user.id });
      expect(repo.remove).toHaveBeenCalledWith(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
