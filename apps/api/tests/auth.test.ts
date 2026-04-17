import { describe, it, expect, test } from 'bun:test';
import { configs } from '@configs';

describe('Auth Utilities', () => {
  it('Configuration should include Argon2 options', () => {
    expect(configs.AUTH.ARGON2_OPTIONS).toBeDefined();
    expect(configs.AUTH.ARGON2_OPTIONS.algorithm).toBe('argon2id');
  });

  test('Bun.password should hash and verify correctly', async () => {
    const password = 'TestPassword123!';

    // Hash
    const start = performance.now();
    const hash = await Bun.password.hash(password, configs.AUTH.ARGON2_OPTIONS);
    const end = performance.now();

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);

    console.log(`Hashing took ${end - start}ms`);

    // Verify correct password
    const isValid = await Bun.password.verify(password, hash);
    expect(isValid).toBe(true);

    // Verify incorrect password
    const isInvalid = await Bun.password.verify('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });
});
