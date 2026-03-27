/**
 * Auth Core Service
 * 
 * Handles core authentication operations:
 * - User registration
 * - User login
 * - Debt linking for new users
 * 
 * Dependencies: db, emailService, emailVerificationService
 */
import { randomUUIDv7 } from 'bun';
import { users, debts, eq, and, isNull, type NewUser } from '@repo/db';
import { DEFAULT_USER_PERMISSIONS } from '@repo/permissions';
import { configs } from '../../configs';
import {
  normalizePhoneNumber,
  validatePasswordComplexity,
  isCommonPassword,
  toSafeUser
} from '@utils';
import { logger } from '@repo/logger';
import type { DbClient } from '@/types';
import type { RegisterInput, AuthResult } from '@/types';
import type { EmailService } from '@services/email/email.service';
import type { EmailVerificationService } from '@services/email/email-verification.service';
import { dbCircuitBreaker, DatabaseError as _DatabaseError } from '../../utils/database';

/**
 * AuthCoreService - Core registration and login operations
 */
export class AuthCoreService {
  constructor(
    private db: DbClient,
    private emailService: EmailService,
    private emailVerificationService: EmailVerificationService
  ) {}

  /**
   * Link existing debts to a newly registered user based on phone number
   */
  private async linkDebtsToUser(userId: string, phoneNumber: string) {
    await dbCircuitBreaker.execute(async () =>
      this.db
        .update(debts)
        .set({ debtorId: userId, updatedAt: new Date() })
        .where(and(eq(debts.debtorPhone, phoneNumber), isNull(debts.debtorId)))
    );

    await dbCircuitBreaker.execute(async () =>
      this.db
        .update(debts)
        .set({ creditorId: userId, updatedAt: new Date() })
        .where(and(eq(debts.creditorPhone, phoneNumber), isNull(debts.creditorId)))
    );
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    try {
      const { name, email, password, phoneNumber } = input;

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        return { success: false, error: 'Invalid phone number format' };
      }

      // SECURITY: Validate password complexity
      const passwordValidation = validatePasswordComplexity(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.errors.join('. ')
        };
      }

      // SECURITY: Check against common passwords
      if (isCommonPassword(password)) {
        return {
          success: false,
          error: 'Password is too common. Please choose a stronger password.'
        };
      }

      // Check phone uniqueness
      const existingPhone = this.db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, normalizedPhone))
        .get();
      if (existingPhone) {
        return { success: false, error: 'Phone number already registered' };
      }

      // Check email uniqueness if provided
      if (email) {
        const existingEmail = await dbCircuitBreaker.execute(async () =>
          this.db.select().from(users).where(eq(users.email, email)).get()
        );
        if (existingEmail) {
          return { success: false, error: 'Email already registered' };
        }
      }

      const hashedPassword = await Bun.password.hash(password, configs.AUTH.ARGON2_OPTIONS);
      const userId = randomUUIDv7('base64url');

      let newUser: typeof users.$inferSelect;
      try {
        const result = await dbCircuitBreaker.execute(async () =>
          this.db
            .insert(users)
            .values({
              name,
              email: email || null,
              phoneNumber: normalizedPhone,
              password: hashedPassword,
              permissions: DEFAULT_USER_PERMISSIONS,
              temporaryPasswordUsed: false
            } as NewUser)
            .returning()
        );
        newUser = result[0];
      } catch (error) {
        if (error instanceof _DatabaseError) {
          return {
            success: false,
            error: 'Database temporarily unavailable. Please try again later.'
          };
        }
        throw error;
      }

      await this.linkDebtsToUser(userId, normalizedPhone);

      // Send verification OTP email if user has email
      if (newUser?.email) {
        const result = await this.emailVerificationService.createOtp(newUser.id, newUser.email);
        if (result.success && result.otp) {
          await this.emailService.sendOtp(newUser.email, result.otp, newUser.name);
        }
      }

      return {
        success: true,
        user: toSafeUser(newUser)
      };
    } catch (error: unknown) {
      logger.error('Database error during register', { error: String(error) });
      return { success: false, error: 'DATABASE_ERROR' };
    }
  }
}
