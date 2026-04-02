import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { Account } from '../account/account.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user-role.enum';
import type { OAuthProfile } from '../auth/types';
import type { PaginatedResponse } from 'api/types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findOrCreateUser(profile: OAuthProfile): Promise<User> {
    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);

      const existingAccount = await accountRepo.findOne({
        where: { providerId: profile.providerId, accountId: profile.accountId },
      });

      let user: User;

      if (existingAccount) {
        user = await userRepo.findOneOrFail({
          where: { id: existingAccount.userId },
        });
        await accountRepo.update(existingAccount.id, {
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        });
      } else {
        const existingUser = await userRepo.findOne({
          where: { email: profile.email.toLowerCase() },
        });

        if (existingUser) {
          user = existingUser;
          if (!user.emailVerified) {
            await userRepo.update(user.id, { emailVerified: true });
            user.emailVerified = true;
          }
        } else {
          user = await userRepo.save(
            userRepo.create({
              name: profile.name,
              email: profile.email.toLowerCase(),
              image: profile.image,
              emailVerified: true,
            }),
          );
        }

        await accountRepo.save(
          accountRepo.create({
            userId: user.id,
            providerId: profile.providerId,
            accountId: profile.accountId,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
          }),
        );
      }

      return user;
    });
  }

  async findAll(dto: FindUsersDto): Promise<PaginatedResponse<User>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const roleFilter =
      dto.roles && dto.roles.length > 0 ? { role: In(dto.roles) } : {};

    const where = dto.search
      ? [
          { name: ILike(`%${dto.search}%`), ...roleFilter },
          { email: ILike(`%${dto.search}%`), ...roleFilter },
          { username: ILike(`%${dto.search}%`), ...roleFilter },
        ]
      : dto.roles && dto.roles.length > 0
        ? { role: In(dto.roles) }
        : undefined;

    const order = dto.sortBy
      ? {
          [dto.sortBy]: (dto.sortOrder ?? 'asc').toUpperCase() as
            | 'ASC'
            | 'DESC',
        }
      : undefined;

    const [data, total] = await this.userRepository.findAndCount({
      where,
      order,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();
    await this.assertUniqueEmail(email, undefined);
    if (dto.username != null) {
      await this.assertUniqueUsername(dto.username, undefined);
    }
    if (dto.phone != null) {
      await this.assertUniquePhone(dto.phone, undefined);
    }
    const user = this.userRepository.create({
      ...dto,
      email,
      role: dto.role ?? UserRole.Member,
    });
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.email != null) {
      const email = dto.email.toLowerCase();
      await this.assertUniqueEmail(email, id);
      Object.assign(user, { ...dto, email });
    } else {
      Object.assign(user, dto);
    }
    if (dto.username !== undefined && dto.username != null) {
      await this.assertUniqueUsername(dto.username, id);
    }
    if (dto.phone !== undefined && dto.phone != null) {
      await this.assertUniquePhone(dto.phone, id);
    }
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  private async assertUniqueEmail(
    email: string,
    excludeId: string | undefined,
  ): Promise<void> {
    const existing = await this.userRepository.findOneBy({ email });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Email already in use');
    }
  }

  private async assertUniqueUsername(
    username: string,
    excludeId: string | undefined,
  ): Promise<void> {
    const existing = await this.userRepository.findOneBy({ username });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Username already in use');
    }
  }

  private async assertUniquePhone(
    phone: string,
    excludeId: string | undefined,
  ): Promise<void> {
    const existing = await this.userRepository.findOneBy({ phone });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Phone already in use');
    }
  }
}
