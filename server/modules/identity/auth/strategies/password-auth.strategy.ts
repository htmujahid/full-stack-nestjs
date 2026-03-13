import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../../account/account.entity';
import { User } from '../../user/user.entity';
import { CREDENTIAL_PROVIDER, SALT_ROUNDS } from '../auth.constants';

@Injectable()
export class PasswordAuthStrategy extends PassportStrategy(
  Strategy,
  'password-auth',
) {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super({ usernameField: 'identifier' });
  }

  async validate(identifier: string, password: string): Promise<User> {
    const userRepo = this.dataSource.getRepository(User);
    const accountRepo = this.dataSource.getRepository(Account);

    // Look up by email, username, or phone depending on identifier format.
    // Currently supports email; extend this block when username/phone fields are added.
    const user = await this.resolveUser(identifier, userRepo);

    if (!user) {
      await bcrypt.hash(password, SALT_ROUNDS); // prevent timing attacks
      throw new UnauthorizedException('Invalid credentials');
    }

    const account = await accountRepo.findOne({
      where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
      select: { id: true, password: true },
    });

    if (!account?.password) {
      await bcrypt.hash(password, SALT_ROUNDS);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    
    if (user.phone?.includes('+') && !user.phoneVerified) throw new ForbiddenException('Phone not verified');

    if (!user.emailVerified) throw new ForbiddenException('Email not verified');

    return user;
  }

  private async resolveUser(
    identifier: string,
    userRepo: Repository<User>,
  ): Promise<User | null> {
    const normalized = identifier.toLowerCase().trim();

    // Email
    if (normalized.includes('@')) {
      return userRepo.findOne({ where: { email: normalized } });
    }

    // Username
    const byUsername = await userRepo.findOne({ where: { username: normalized } });
    if (byUsername) return byUsername;

    // Phone (keep original formatting for E.164 lookup)
    const byPhone = await userRepo.findOne({ where: { phone: identifier.trim() } });
    if (byPhone) return byPhone;

    return null;
  }
}
