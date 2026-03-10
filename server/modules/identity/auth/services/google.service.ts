import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../user/user.entity';
import { Account } from '../entities/account.entity';
import { GOOGLE_PROVIDER } from '../auth.constants';
import { AuthService, type RequestContext, type TokenPair } from './auth.service';
import type { GoogleProfile } from '../strategies/google.strategy';

@Injectable()
export class GoogleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  async signIn(
    profile: GoogleProfile,
    ctx: RequestContext,
  ): Promise<{ user: User; tokens: TokenPair }> {
    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);

      const existingAccount = await accountRepo.findOne({
        where: { providerId: GOOGLE_PROVIDER, accountId: profile.accountId },
      });

      let user: User;

      if (existingAccount) {
        user = await userRepo.findOneOrFail({ where: { id: existingAccount.userId } });
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

      const tokens = await this.authService.createAuthSession(user.id, true, ctx, 'google');
      return { user, tokens };
    });
  }
}
