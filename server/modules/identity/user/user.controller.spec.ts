import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../rbac/roles.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { UserRole } from './user-role.enum';

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

const mockUserService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('UserController', () => {
  let controller: UserController;
  let service: ReturnType<typeof mockUserService>;

  beforeEach(async () => {
    service = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(UserController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll() and returns result', async () => {
      const users = [makeUser()];
      service.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(users);
    });

    it('returns an empty array when service returns none', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id) and returns result', async () => {
      const user = makeUser();
      service.findOne.mockResolvedValue(user);

      const result = await controller.findOne(user.id);

      expect(service.findOne).toHaveBeenCalledWith(user.id);
      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(result).toBe(user);
    });

    it('propagates NotFoundException from service when user is not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.findOne('missing-id')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create(dto) and returns result', async () => {
      const dto: CreateUserDto = {
        name: 'New User',
        email: 'new@example.com',
      };
      const user = makeUser({ name: 'New User', email: 'new@example.com' });

      service.create.mockResolvedValue(user);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(result).toBe(user);
    });

    it('passes dto unchanged to service', async () => {
      const dto: CreateUserDto = {
        name: 'My User',
        email: 'user@example.com',
        username: 'johndoe',
        role: UserRole.Admin,
      };
      service.create.mockResolvedValue(makeUser());

      await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto) and returns result', async () => {
      const user = makeUser();
      const dto: UpdateUserDto = { name: 'Updated Name' };
      const updatedUser = makeUser({ name: 'Updated Name' });

      service.update.mockResolvedValue(updatedUser);

      const result = await controller.update(user.id, dto);

      expect(service.update).toHaveBeenCalledWith(user.id, dto);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(updatedUser);
    });

    it('propagates NotFoundException from service when user is not found', async () => {
      const dto: UpdateUserDto = { name: 'Updated' };

      service.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(
        controller.update('missing-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException from service on uniqueness violation', async () => {
      const dto: UpdateUserDto = { email: 'taken@example.com' };

      service.update.mockRejectedValue(
        new ConflictException('Email already in use'),
      );

      await expect(
        controller.update('user-id', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id) and returns undefined', async () => {
      const user = makeUser();
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(user.id);

      expect(service.remove).toHaveBeenCalledWith(user.id);
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from service when user is not found', async () => {
      service.remove.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
