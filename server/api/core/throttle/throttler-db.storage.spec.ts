import { ThrottlerDbStorage } from './throttler-db.storage';
import type { Repository } from 'typeorm';
import type { RateLimit } from './rate-limit.entity';

const NOW = 1_000_000;
const TTL = 60_000; // 60 s
const LIMIT = 5;
const BLOCK_DURATION = 30_000; // 30 s
const THROTTLER = 'default';

const makeRepo = (): jest.Mocked<
  Pick<Repository<RateLimit>, 'findOne' | 'create' | 'save'>
> => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const makeRecord = (overrides: Partial<RateLimit> = {}): RateLimit =>
  ({
    key: 'test-key',
    count: 0,
    lastRequest: NOW,
    windowStart: NOW,
    blockExpiresAt: 0,
    ...overrides,
  }) as RateLimit;

const call = (storage: ThrottlerDbStorage, key = 'test-key') =>
  storage.increment(key, TTL, LIMIT, BLOCK_DURATION, THROTTLER);

describe('ThrottlerDbStorage', () => {
  let repo: ReturnType<typeof makeRepo>;
  let storage: ThrottlerDbStorage;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    repo = makeRepo();
    storage = new ThrottlerDbStorage(repo as unknown as Repository<RateLimit>);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── New key ────────────────────────────────────────────────────────────────

  describe('new key (no existing record)', () => {
    beforeEach(() => {
      const fresh = makeRecord({ count: 0 });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(fresh);
      repo.save.mockResolvedValue(fresh);
    });

    it('creates a new record', async () => {
      await call(storage);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'test-key', count: 0 }),
      );
    });

    it('returns totalHits = 1 and isBlocked = false', async () => {
      const result = await call(storage);
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
      expect(result.timeToBlockExpire).toBe(0);
    });

    it('handles ER_DUP_ENTRY race (concurrent inserts) by retrying findOne', async () => {
      const fresh = makeRecord({ count: 0 });
      const existing = makeRecord({ count: 1, lastRequest: NOW });
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      repo.create.mockReturnValue(fresh);
      repo.save
        .mockRejectedValueOnce(
          Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }),
        )
        .mockResolvedValueOnce(existing);

      const result = await call(storage);

      expect(repo.findOne).toHaveBeenCalledTimes(2);
      expect(result.totalHits).toBe(2);
    });
  });

  // ─── Within window, below limit ─────────────────────────────────────────────

  describe('existing record — within window, below limit', () => {
    it('increments count and returns isBlocked = false', async () => {
      const record = makeRecord({ count: 2, windowStart: NOW });
      repo.findOne.mockResolvedValue(record);
      repo.save.mockResolvedValue(record);

      const result = await call(storage);

      expect(result.totalHits).toBe(3);
      expect(result.isBlocked).toBe(false);
    });

    it('returns a positive timeToExpire', async () => {
      const record = makeRecord({ count: 1, windowStart: NOW });
      repo.findOne.mockResolvedValue(record);
      repo.save.mockResolvedValue(record);

      const result = await call(storage);

      expect(result.timeToExpire).toBe(Math.ceil(TTL / 1000));
    });
  });

  // ─── Window expired ─────────────────────────────────────────────────────────

  describe('existing record — window has expired', () => {
    it('resets count and starts a fresh window', async () => {
      const record = makeRecord({
        count: 4,
        windowStart: NOW - TTL, // window exactly expired
      });
      repo.findOne.mockResolvedValue(record);
      repo.save.mockResolvedValue(record);

      const result = await call(storage);

      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
    });
  });

  // ─── Exceeds limit → block ───────────────────────────────────────────────────

  describe('increment pushes count over limit', () => {
    it('sets blockExpiresAt and returns isBlocked = true', async () => {
      const record = makeRecord({ count: LIMIT, windowStart: NOW });
      repo.findOne.mockResolvedValue(record);
      repo.save.mockResolvedValue(record);

      const result = await call(storage);

      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(Math.ceil(BLOCK_DURATION / 1000));
    });
  });

  // ─── Currently blocked ───────────────────────────────────────────────────────

  describe('existing record — currently blocked', () => {
    it('returns isBlocked = true without incrementing', async () => {
      const record = makeRecord({
        count: LIMIT + 1,
        windowStart: NOW,
        blockExpiresAt: NOW + BLOCK_DURATION,
      });
      repo.findOne.mockResolvedValue(record);
      repo.save.mockResolvedValue(record);

      const result = await call(storage);

      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(Math.ceil(BLOCK_DURATION / 1000));
    });

    it('does not call save while blocked', async () => {
      const record = makeRecord({
        count: LIMIT + 1,
        windowStart: NOW,
        blockExpiresAt: NOW + BLOCK_DURATION,
      });
      repo.findOne.mockResolvedValue(record);

      await call(storage);

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ─── Block expired ───────────────────────────────────────────────────────────

  describe('existing record — block has expired', () => {
    it('resets block and allows the request through', async () => {
      const record = makeRecord({
        count: LIMIT + 1,
        windowStart: NOW - TTL,
        blockExpiresAt: NOW - 1, // expired 1 ms ago
      });
      repo.findOne.mockResolvedValue(record);
      repo.save.mockResolvedValue(record);

      const result = await call(storage);

      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
    });
  });
});
