import { describe, expect, test } from 'bun:test';
import { UserRepository } from '@/repositories/user/user.repo';
import { SessionRepository } from '@/repositories/auth/session.repo';
import { DebtRepository } from '@/repositories/debt/debt.repo';

describe('Repository Construction', () => {
  test('repositories instantiate without DI container', () => {
    expect(new UserRepository()).toBeDefined();
    expect(new SessionRepository()).toBeDefined();
    expect(new DebtRepository()).toBeDefined();
  });
});
