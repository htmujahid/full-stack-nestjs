import type { Repository } from 'typeorm';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RateLimit } from './rate-limit.entity';

export class ThrottlerDbStorage implements ThrottlerStorage {
  constructor(private readonly repo: Repository<RateLimit>) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const now = Date.now();
    const ttlMs = ttl;

    let record = await this.repo.findOne({ where: { key } });

    if (!record) {
      record = this.repo.create({
        key,
        count: 0,
        lastRequest: now,
        windowStart: now,
        blockExpiresAt: 0,
      });
      await this.repo.save(record);
    }

    const rec = record;
    const windowExpired = now - Number(rec.windowStart) >= ttlMs;
    const blockExpired = rec.blockExpiresAt > 0 && now >= Number(rec.blockExpiresAt);

    if (blockExpired) {
      rec.count = 0;
      rec.windowStart = now;
      rec.blockExpiresAt = 0;
    } else if (windowExpired) {
      rec.count = 0;
      rec.windowStart = now;
    }

    if (rec.blockExpiresAt > 0 && now < Number(rec.blockExpiresAt)) {
      const timeToBlockExpire = Math.ceil(
        (Number(rec.blockExpiresAt) - now) / 1000,
      );
      return {
        totalHits: rec.count,
        timeToExpire: Math.max(0, Math.ceil((Number(rec.windowStart) + ttlMs - now) / 1000)),
        isBlocked: true,
        timeToBlockExpire,
      };
    }

    rec.count += 1;
    rec.lastRequest = now;
    await this.repo.save(rec);

    if (rec.count > limit) {
      rec.blockExpiresAt = now + blockDuration;
      await this.repo.save(rec);
      return {
        totalHits: rec.count,
        timeToExpire: Math.max(0, Math.ceil((Number(rec.windowStart) + ttlMs - now) / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    }

    const timeToExpire = Math.max(
      0,
      Math.ceil((Number(rec.windowStart) + ttlMs - now) / 1000),
    );
    return {
      totalHits: rec.count,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
