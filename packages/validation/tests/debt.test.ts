import { describe, expect, test } from 'bun:test';
import { safeParse } from 'valibot';
import { CreateDebtInputSchema } from '../src/debt';
import { DEBT_MIN_AMOUNT, DEBT_MAX_AMOUNT } from '@repo/config';

describe('Validation: CreateDebt', () => {
  test('should accept valid input', () => {
    const input = {
      amount: DEBT_MIN_AMOUNT + 1000,
      description: 'Dinner',
      counterpartyPhone: '0912345678',
      direction: 'LEND'
    };
    const result = safeParse(CreateDebtInputSchema, input);
    expect(result.success).toBe(true);
  });

  test('should reject amount below minimum', () => {
    const input = {
      amount: DEBT_MIN_AMOUNT - 1,
      description: 'Too small',
      counterpartyPhone: '0912345678',
      direction: 'BORROW'
    };
    const result = safeParse(CreateDebtInputSchema, input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toContain(`Minimum amount is ${DEBT_MIN_AMOUNT}`);
    }
  });

  test('should reject amount above maximum', () => {
    const input = {
      amount: DEBT_MAX_AMOUNT + 1,
      description: 'Too big',
      counterpartyPhone: '0912345678',
      direction: 'LEND'
    };
    const result = safeParse(CreateDebtInputSchema, input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toContain(`Maximum amount is ${DEBT_MAX_AMOUNT}`);
    }
  });

  test('should reject invalid phone', () => {
    const input = {
      amount: 50000,
      description: 'Bad phone',
      counterpartyPhone: '123', // Too short
      direction: 'LEND'
    };
    const result = safeParse(CreateDebtInputSchema, input);
    expect(result.success).toBe(false);
  });
});
