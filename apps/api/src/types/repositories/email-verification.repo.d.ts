export interface IEmailVerificationRepository {
  invalidateExisting(userId: string, email: string): Promise<void>;
  create(data: {
    id: string;
    userId: string;
    email: string;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    maxAttempts: number;
    verified: boolean;
  }): Promise<void>;
  findLatestUnverified(email: string): Promise<{
    id: string;
    userId: string;
    email: string;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    maxAttempts: number;
    verified: boolean;
    createdAt: Date;
    lastSentAt: Date;
  } | null>;
  updateAttempts(id: string, attempts: number): Promise<void>;
  markVerified(id: string): Promise<void>;
  findAllByUserIdAndEmail(userId: string, email: string): Promise<Array<{ createdAt: Date; lastSentAt: Date }>>;
  getPendingCount(userId: string): Promise<number>;
}
