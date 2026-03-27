/**
 * Email Verification Service Unit Tests
 *
 * Tests OTP generation, verification, rate limiting, and status checks.
 */
import { describe, expect, it, beforeEach } from 'bun:test';
import { EmailVerificationService } from '@/services/email/email-verification.service';
import type { DbClient } from '@/types';

// Mock database for testing
function createMockDb() {
  const emailVerifications: Record<string, unknown>[] = [];
  const users: Record<string, unknown>[] = [
    {
      id: 'test-user-1',
      email: 'test@example.com',
      emailVerified: false,
      name: 'Test User'
    }
  ];

  return {
    select: () => ({
      from: (table: { name: string }) => ({
        where: () => ({
          get: () => {
            if (table.name === 'users') {
              return users[0];
            }
            return emailVerifications.find((v) => !v.verified);
          },
          all: () => emailVerifications,
          orderBy: () => ({
            get: () => emailVerifications.find((v) => !v.verified)
          })
        })
      })
    }),
    insert: () => ({
      values: (data: Record<string, unknown>) => {
        emailVerifications.push(data);
        return Promise.resolve();
      }
    }),
    update: (table: { name: string }) => ({
      set: (data: Record<string, unknown>) => ({
        where: () => {
          if (table.name === 'users' && data.emailVerified !== undefined) {
            users[0].emailVerified = data.emailVerified;
          }
          return Promise.resolve();
        }
      })
    }),
    // For tests to verify state
    _getVerifications: () => emailVerifications,
    _getUsers: () => users
  };
}

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new EmailVerificationService(mockDb as unknown as DbClient);
  });

  describe('createOtp', () => {
    it('should generate a 6-digit OTP', async () => {
      const result = await service.createOtp('test-user-1', 'test@example.com');

      expect(result.success).toBe(true);
      expect(result.otp).toBeDefined();
      expect(result.otp!.length).toBe(6);
      expect(/^\d{6}$/.test(result.otp!)).toBe(true);
    });

    it('should store OTP in database', async () => {
      await service.createOtp('test-user-1', 'test@example.com');

      const verifications = mockDb._getVerifications();
      expect(verifications.length).toBe(1);
      expect(verifications[0].userId).toBe('test-user-1');
      expect(verifications[0].email).toBe('test@example.com');
      expect(verifications[0].otpHash).toBeDefined();
    });
  });

  describe('canSendEmailTo', () => {
    it('should return false for unverified email', () => {
      const result = service.canSendEmailTo({
        email: 'test@example.com',
        emailVerified: false
      });

      expect(result).toBe(false);
    });

    it('should return true for verified email', () => {
      const result = service.canSendEmailTo({
        email: 'test@example.com',
        emailVerified: true
      });

      expect(result).toBe(true);
    });

    it('should return false for no email', () => {
      const result = service.canSendEmailTo({
        email: null,
        emailVerified: false
      });

      expect(result).toBe(false);
    });
  });
});
