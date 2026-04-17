import type { EmailVerification } from '@repo/db';

export interface EmailVerificationRepositoryInterface {
  create(data: Omit<EmailVerification, 'createdAt' | 'updatedAt' | 'verified' | 'attempts'>): Promise<EmailVerification>;
  findLatestByUserAndEmail(userId: string, email: string): Promise<EmailVerification | null>;
  updateAttempts(id: string, attempts: number): Promise<void>;
  markVerified(id: string): Promise<void>;
  findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]>;
  getPendingCount(userId: string): Promise<number>;
}
