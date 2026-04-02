import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './account.entity';
import { LinkAccountData } from './types';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  listAccounts(userId: string) {
    return this.accountRepo.find({
      where: { userId },
      select: {
        id: true,
        providerId: true,
        accountId: true,
        scope: true,
        accessTokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async linkAccount(userId: string, data: LinkAccountData) {
    const existingAccount = await this.accountRepo.findOne({
      where: { providerId: data.providerId, accountId: data.accountId },
    });

    if (existingAccount) {
      if (existingAccount.userId === userId) {
        throw new BadRequestException(
          `This ${data.providerId} account is already linked to your account`,
        );
      }
      throw new BadRequestException(
        `This ${data.providerId} account is already linked to another account`,
      );
    }

    const userProviderAccount = await this.accountRepo.findOne({
      where: { userId, providerId: data.providerId },
    });

    if (userProviderAccount) {
      throw new BadRequestException(
        `You already have a ${data.providerId} account linked`,
      );
    }
    console.log(userProviderAccount);

    await this.accountRepo.save(
      this.accountRepo.create({
        userId,
        providerId: data.providerId,
        accountId: data.accountId,
        accessToken: data.accessToken ?? null,
        refreshToken: data.refreshToken ?? null,
        scope: data.scope ?? null,
      }),
    );
  }

  async unlinkAccount(userId: string, accountId: string) {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const totalAccounts = await this.accountRepo.count({ where: { userId } });

    if (totalAccounts === 1) {
      throw new BadRequestException(
        'Cannot unlink the last authentication method. Please add another sign-in method first.',
      );
    }

    await this.accountRepo.remove(account);
  }
}
