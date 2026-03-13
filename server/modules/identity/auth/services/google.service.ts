import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../user/user.entity';
import { Account } from '../../account/account.entity';
import { GOOGLE_PROVIDER } from '../auth.constants';
import {
  AuthService,
  type RequestContext,
  type TokenPair,
} from './auth.service';
import type { GoogleProfile } from '../strategies/google.strategy';
import { UserRole } from '../../user/user-role.enum';

@Injectable()
export class GoogleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  async findOrCreateUser(profile: GoogleProfile): Promise<User> {
    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);

      const existingAccount = await accountRepo.findOne({
        where: { providerId: GOOGLE_PROVIDER, accountId: profile.accountId },
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
            providerId: GOOGLE_PROVIDER,
            accountId: profile.accountId,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
          }),
        );
      }

      return user;
    });
  }

  async createSession(userId: string, role: UserRole, ctx: RequestContext): Promise<TokenPair> {
    return this.authService.createAuthSession(userId, role, true, ctx, 'google');
  }
}
