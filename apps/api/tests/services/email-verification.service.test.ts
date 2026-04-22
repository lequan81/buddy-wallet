/**
 * Email Verification Service Unit Tests
 *
 * Tests OTP generation, verification, rate limiting, and status checks.
 */
import { describe, expect, it, beforeEach } from 'bun:test';
import { EmailVerificationService } from '@/app/Services/EmailVerificationService';

function createMockRepos() {
  const emailVerifications: Record<string, unknown>[] = [];
  const users: Record<string, unknown>[] = [
    {
      id: 'test-user-1',
      email: 'test@example.com',
      emailVerified: false,
      name: 'Test User'
    }
  ];

  const emailVerificationRepo = {
    invalidateExisting: async (userId: string, email: string) => {
      for (const verification of emailVerifications) {
        if (verification.userId === userId && verification.email === email) {
          verification.verified = true;
        }
      }
    },
    create: async (data: Record<string, unknown>) => {
      emailVerifications.push({
        ...data,
        createdAt: new Date(),
        lastSentAt: new Date()
      });
    },
    findLatestUnverified: async (email: string) => {
      const records = emailVerifications
        .filter((v) => v.email === email && v.verified === false)
        .sort((a, b) => Number(b.createdAt as Date) - Number(a.createdAt as Date));
      return (records[0] as unknown as Record<string, unknown>) ?? null;
    },
    updateAttempts: async (id: string, attempts: number) => {
      const verification = emailVerifications.find((v) => v.id === id);
      if (verification) verification.attempts = attempts;
    },
    markVerified: async (id: string) => {
      const verification = emailVerifications.find((v) => v.id === id);
      if (verification) verification.verified = true;
    },
    findAllByUserIdAndEmail: async (userId: string, email: string) =>
      emailVerifications.filter((v) => v.userId === userId && v.email === email) as unknown as Record<string, unknown>[],
    getPendingCount: async (userId: string) =>
      emailVerifications.filter((v) => v.userId === userId && v.verified === false).length
  };

  const userRepo = {
    findById: async (id: string) => (users.find((u) => u.id === id) as unknown as Record<string, unknown>) ?? null,
    update: async (id: string, data: Record<string, unknown>) => {
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, data);
      return user as unknown as Record<string, unknown>;
    }
  };

  return {
    emailVerificationRepo,
    userRepo,
    _getVerifications: () => emailVerifications,
    _getUsers: () => users
  };
}

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let mockRepos: ReturnType<typeof createMockRepos>;

  beforeEach(() => {
    mockRepos = createMockRepos();
    service = new EmailVerificationService(
      mockRepos.emailVerificationRepo as unknown as ConstructorParameters<typeof EmailVerificationService>[0],
      mockRepos.userRepo as unknown as ConstructorParameters<typeof EmailVerificationService>[1]
    );
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

      const verifications = mockRepos._getVerifications();
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
