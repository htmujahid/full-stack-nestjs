import {
  decrypt,
  encrypt,
  hashToken,
  signHmac,
  verifyHmac,
  verifyToken,
} from './crypto.util';

const SECRET = 'test-secret-key';
const ALT_SECRET = 'other-secret-key';

describe('crypto.util', () => {
  // ─── encrypt / decrypt ──────────────────────────────────────────────────────

  describe('encrypt', () => {
    it('returns a dot-separated iv.ciphertext.tag string', () => {
      const result = encrypt('hello', SECRET);
      const parts = result.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('produces different ciphertext on subsequent calls (random IV)', () => {
      const first = encrypt('same text', SECRET);
      const second = encrypt('same text', SECRET);
      expect(first).not.toBe(second);
    });
  });

  describe('decrypt', () => {
    it('round-trips: decrypted text equals original plaintext', () => {
      const plaintext = 'super secret message';
      const ciphertext = encrypt(plaintext, SECRET);
      expect(decrypt(ciphertext, SECRET)).toBe(plaintext);
    });

    it('preserves unicode and special characters through the round-trip', () => {
      const plaintext = 'こんにちは 🔐 <>&"\'';
      const ciphertext = encrypt(plaintext, SECRET);
      expect(decrypt(ciphertext, SECRET)).toBe(plaintext);
    });

    it('throws when decrypting with wrong key (auth tag mismatch)', () => {
      const ciphertext = encrypt('secret', SECRET);
      expect(() => decrypt(ciphertext, ALT_SECRET)).toThrow();
    });

    it('throws when the ciphertext is tampered with', () => {
      const ciphertext = encrypt('secret', SECRET);
      const [iv, enc, tag] = ciphertext.split('.');
      const tampered = `${iv}.${enc.slice(0, -2)}ff.${tag}`;
      expect(() => decrypt(tampered, SECRET)).toThrow();
    });
  });

  // ─── hashToken ───────────────────────────────────────────────────────────────

  describe('hashToken', () => {
    it('returns a 64-character hex string', () => {
      const result = hashToken('any-token');
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic: same input always yields the same hash', () => {
      const token = 'deterministic-token';
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });

  // ─── verifyToken ─────────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('returns true when the token matches the stored hash', () => {
      const token = 'valid-token-123';
      const stored = hashToken(token);
      expect(verifyToken(token, stored)).toBe(true);
    });

    it('returns false when the token does not match', () => {
      const stored = hashToken('correct-token');
      expect(verifyToken('wrong-token', stored)).toBe(false);
    });

    it('returns false when the stored hash is tampered with', () => {
      const token = 'real-token';
      const stored = hashToken(token);
      const tampered = stored.slice(0, -2) + 'ff';
      expect(verifyToken(token, tampered)).toBe(false);
    });

    it('returns false for an empty token against a non-empty hash', () => {
      const stored = hashToken('non-empty');
      expect(verifyToken('', stored)).toBe(false);
    });
  });

  // ─── signHmac ────────────────────────────────────────────────────────────────

  describe('signHmac', () => {
    it('returns a 64-character hex string', () => {
      const result = signHmac(SECRET, 'data');
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same secret and data', () => {
      expect(signHmac(SECRET, 'payload')).toBe(signHmac(SECRET, 'payload'));
    });

    it('produces different signatures for different data', () => {
      expect(signHmac(SECRET, 'data-a')).not.toBe(signHmac(SECRET, 'data-b'));
    });

    it('produces different signatures for different secrets', () => {
      expect(signHmac(SECRET, 'data')).not.toBe(signHmac(ALT_SECRET, 'data'));
    });
  });

  // ─── verifyHmac ──────────────────────────────────────────────────────────────

  describe('verifyHmac', () => {
    it('returns true for a valid signature', () => {
      const data = 'important payload';
      const signature = signHmac(SECRET, data);
      expect(verifyHmac(SECRET, data, signature)).toBe(true);
    });

    it('returns false when the data has been tampered with', () => {
      const signature = signHmac(SECRET, 'original data');
      expect(verifyHmac(SECRET, 'tampered data', signature)).toBe(false);
    });

    it('returns false when the wrong secret is used for verification', () => {
      const signature = signHmac(SECRET, 'data');
      expect(verifyHmac(ALT_SECRET, 'data', signature)).toBe(false);
    });

    it('returns false for a completely invalid signature string', () => {
      const data = 'data';
      const fakeSignature = signHmac(ALT_SECRET, 'unrelated');
      expect(verifyHmac(SECRET, data, fakeSignature)).toBe(false);
    });
  });
});
