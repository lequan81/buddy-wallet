import type { EmailVerification } from '@repo/db';

export interface EmailVerificationRepositoryInterface {
  create(data: Omit<EmailVerification, 'createdAt' | 'verified' | 'attempts' | 'lastSentAt' | 'maxAttempts'> & { maxAttempts?: number }): Promise<EmailVerification>;
  findLatestByUserAndEmail(userId: string, email: string): Promise<EmailVerification | null>;
  findLatestUnverified(email: string): Promise<EmailVerification | null>;
  invalidateExisting(userId: string, email: string): Promise<void>;
  updateAttempts(id: string, attempts: number): Promise<void>;
  markVerified(id: string): Promise<void>;
  findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]>;
  getPendingCount(userId: string): Promise<number>;
}

