import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Account } from '../account.entity';
import { User } from '../../user/user.entity';
import { CREDENTIAL_PROVIDER, SALT_ROUNDS } from '../auth.constants';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();
    const userRepo = this.dataSource.getRepository(User);
    const accountRepo = this.dataSource.getRepository(Account);

    const user = await userRepo.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      await bcrypt.hash(password, SALT_ROUNDS); // prevent timing attacks
      throw new UnauthorizedException('Invalid email or password');
    }

    const account = await accountRepo.findOne({
      where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
      select: { id: true, password: true },
    });

    if (!account?.password) {
      await bcrypt.hash(password, SALT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (!user.emailVerified) throw new ForbiddenException('Email not verified');

    return user;
  }
}
