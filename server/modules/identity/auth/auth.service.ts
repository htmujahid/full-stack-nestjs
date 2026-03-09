import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Account } from './account.entity';
import { Session } from './session.entity';
import { User } from '../user/user.entity';
import type { SignUpDto } from './dto/sign-up.dto';

const CREDENTIAL_PROVIDER = 'credential';
const SALT_ROUNDS = 10;
const SESSION_TTL_DAYS_SHORT = 7;
const SESSION_TTL_DAYS_LONG = 30;

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  async signUp(dto: SignUpDto): Promise<{
    token: string | null;
    user: Omit<User, 'accounts'>;
  }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const rememberMe = dto.rememberMe !== false;

    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);
      const sessionRepo = tx.getRepository(Session);

      const existing = await userRepo.findOne({
        where: { email: normalizedEmail },
      });

      if (existing) {
        // Hash password to mitigate timing attacks
        await bcrypt.hash(dto.password, SALT_ROUNDS);
        throw new ConflictException('User already exists. Use another email.');
      }

      const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

      const user = userRepo.create({
        name: dto.name,
        email: normalizedEmail,
        image: dto.image ?? null,
        emailVerified: false,
      });
      const savedUser = await userRepo.save(user);

      const account = accountRepo.create({
        userId: savedUser.id,
        providerId: CREDENTIAL_PROVIDER,
        accountId: savedUser.id,
        password: hash,
      });
      await accountRepo.save(account);

      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + (rememberMe ? SESSION_TTL_DAYS_LONG : SESSION_TTL_DAYS_SHORT),
      );

      const session = sessionRepo.create({
        userId: savedUser.id,
        token: randomUUID(),
        expiresAt,
      });
      const savedSession = await sessionRepo.save(session);

      const { accounts: _, ...userWithoutAccounts } = savedUser;
      return {
        token: savedSession.token,
        user: userWithoutAccounts,
      };
    });
  }
}
