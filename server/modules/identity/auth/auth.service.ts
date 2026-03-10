import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { Account } from './account.entity';
import { Session } from './session.entity';
import { User } from '../user/user.entity';
import {
  CREDENTIAL_PROVIDER,
  SALT_ROUNDS,
  SESSION_EXPIRES_IN_MS,
  SESSION_REMEMBER_ME_EXPIRES_IN_MS,
} from './auth.constants';
import type { SignUpDto } from './dto/sign-up.dto';
import type { SignInDto } from './dto/sign-in.dto';

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

  async signIn(
    dto: SignInDto,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<{ user: Omit<User, 'accounts' | 'sessions'>; session: Session }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const rememberMe = dto.rememberMe !== false;

    const userRepo = this.dataSource.getRepository(User);
    const accountRepo = this.dataSource.getRepository(Account);
    const sessionRepo = this.dataSource.getRepository(Session);

    const user = await userRepo.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      // Hash anyway to prevent timing attacks from revealing valid emails
      await bcrypt.hash(dto.password, SALT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    const account = await accountRepo.findOne({
      where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
      select: { id: true, password: true },
    });

    if (!account?.password) {
      await bcrypt.hash(dto.password, SALT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await bcrypt.compare(dto.password, account.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    const expiresAt = new Date(
      Date.now() +
        (rememberMe ? SESSION_REMEMBER_ME_EXPIRES_IN_MS : SESSION_EXPIRES_IN_MS),
    );
    const token = randomBytes(32).toString('hex');

    const session = sessionRepo.create({
      userId: user.id,
      token,
      expiresAt,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await sessionRepo.save(session);

    return { user, session };
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
