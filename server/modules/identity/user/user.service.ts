import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user-role.enum';

export type UsersPage = {
  data: User[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(dto: FindUsersDto): Promise<UsersPage> {
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
