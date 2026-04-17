import { injectable, inject } from 'tsyringe';
import { type User } from '@repo/db';
import type { UserRepositoryInterface } from '@/app/Repositories/Contracts/UserRepositoryInterface';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import { configs } from '@/configs';
import { normalizePhoneNumber } from '@repo/utils';
import { toSafeUser, validatePasswordComplexity, isCommonPassword } from '@lib/security/password';
import { logger } from '@repo/logger';
import { EmailService } from './EmailService';
import { EmailVerificationService } from './EmailVerificationService';
import type { RegisterInput, AuthResult } from '@/types';
import { DatabaseError as _DatabaseError } from '@lib/result';

const DEFAULT_USER_PERMISSIONS: string[] = [];

/**
 * AuthService - Core registration and login operations
 */
@injectable()
export class AuthService {
  constructor(
    @inject('UserRepositoryInterface') private readonly userRepo: UserRepositoryInterface,
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    private readonly emailService: EmailService,
    private readonly emailVerificationService: EmailVerificationService
  ) {}


  /**
   * Link existing debts to a newly registered user based on phone number
   */
  private async linkDebtsToUser(userId: string, phoneNumber: string) {
    // SECURITY: Use repository directly, circuit breaker logic should be in repository if needed
    await this.debtRepo.linkDebtsToUser(userId, phoneNumber);
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    try {
      const { name, email, password, phoneNumber } = input;

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        return { code: 'INVALID_PHONE', error: 'Invalid phone number format' };
      }

      // SECURITY: Validate password complexity
      const passwordValidation = validatePasswordComplexity(password);
      if (!passwordValidation.isValid) {
        return {
          code: 'INVALID_PASSWORD',
          error: passwordValidation.errors.join('. ')
        };
      }

      // SECURITY: Check against common passwords
      if (isCommonPassword(password)) {
        return {
          code: 'WEAK_PASSWORD',
          error: 'Password is too common. Please choose a stronger password.'
        };
      }

      // Check phone uniqueness
      const existingPhone = await this.userRepo.findByPhone(normalizedPhone);
      if (existingPhone) {
        return { code: 'PHONE_EXISTS', error: 'Phone number already registered' };
      }
      
      // Check email uniqueness if provided
      if (email) {
        const existingEmail = await this.userRepo.findByEmail(email);
        if (existingEmail) {
          return { code: 'EMAIL_EXISTS', error: 'Email already registered' };
        }
      }

      const hashedPassword = await Bun.password.hash(password, configs.AUTH.ARGON2_OPTIONS);
      let newUser: User;
      try {
        newUser = await this.userRepo.create({
          name,
          email: email || null,
          phoneNumber: normalizedPhone,
          password: hashedPassword,
          permissions: DEFAULT_USER_PERMISSIONS,
          temporaryPasswordUsed: false
        } as Parameters<typeof this.userRepo.create>[0]);
      } catch (error) {
        if (error instanceof _DatabaseError) {
          return {
            code: 'DATABASE_ERROR',
            error: 'Database temporarily unavailable. Please try again later.'
          };
        }
        throw error;
      }

      await this.linkDebtsToUser(newUser.id, normalizedPhone);

      // Send verification OTP email if user has email
      if (newUser?.email) {
        const result = await this.emailVerificationService.createOtp(newUser.id, newUser.email);
        if ('data' in result && result.data.otp) {
          await this.emailService.sendOtp(newUser.email, result.data.otp, newUser.name);
        }
      }

      return {
        data: {
          user: toSafeUser(newUser)
        }
      };
    } catch (error: unknown) {
      logger.error('Database error during register', { error: String(error) });
      return { code: 'UNKNOWN_ERROR', error: 'An unexpected error occurred' };
    }
  }
}
