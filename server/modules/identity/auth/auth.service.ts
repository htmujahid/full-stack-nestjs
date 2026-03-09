import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Account } from './account.entity';
import { User } from '../user/user.entity';
import { CREDENTIAL_PROVIDER, SALT_ROUNDS } from './auth.constants';
import type { SignUpDto } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async signUp(dto: SignUpDto): Promise<{ user: Omit<User, 'accounts'> }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);

      const existing = await userRepo.findOne({
        where: { email: normalizedEmail },
      });

      if (existing) {
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

      const verificationExpiresIn = this.configService.getOrThrow<number>('auth.verificationExpiresIn');
      const token = await this.jwtService.signAsync(
        { email: normalizedEmail },
        { expiresIn: verificationExpiresIn },
      );
      const callbackURL = dto.callbackURL ? encodeURIComponent(dto.callbackURL) : encodeURIComponent('/');
      const baseURL = this.configService.getOrThrow<string>('app.url');
      const url = `${baseURL}/api/auth/verify-email?token=${token}&callbackURL=${callbackURL}`;

      await this.mailerService.sendMail({
        to: normalizedEmail,
        subject: 'Verify your email',
        text: `Verify your email by clicking: ${url}`,
        html: `<p>Verify your email by clicking: <a href="${url}">${url}</a></p>`,
      });

      const { accounts: _, ...userWithoutAccounts } = savedUser;
      return { user: userWithoutAccounts };
    });
  }

  async verifyEmail(token: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{ email?: string }>(token);
      const email = payload.email;
      if (!email || typeof email !== 'string') {
        return { ok: false, error: 'invalid_token' };
      }

      const userRepo = this.dataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email: email.toLowerCase() } });
      if (!user) return { ok: false, error: 'user_not_found' };
      if (user.emailVerified) return { ok: true };

      await userRepo.update(user.id, { emailVerified: true });
      return { ok: true };
    } catch {
      return { ok: false, error: 'invalid_token' };
    }
  }
}
