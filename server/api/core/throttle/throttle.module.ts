import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Repository } from 'typeorm';
import { RateLimit } from './rate-limit.entity';
import { ThrottlerDbStorage } from './throttler-db.storage';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [TypeOrmModule.forFeature([RateLimit])],
      inject: [getRepositoryToken(RateLimit)],
      useFactory: (rateLimitRepo: Repository<RateLimit>) => ({
        storage: new ThrottlerDbStorage(rateLimitRepo),
        throttlers: [
          { name: 'default', ttl: 60000, limit: 60 },
          { name: 'auth', ttl: 60000, limit: 5 },
        ],
      }),
    }),
  ],
})
export class ThrottleModule {}
