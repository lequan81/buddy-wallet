export interface IEmailVerificationRepository {
  create(data: { id: string; userId: string; email: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findLatestUnverified(email: string): Promise<unknown | null>;
  updateAttempts(id: string, attempts: number): Promise<void>;
  markVerified(id: string): Promise<void>;
  findAllByUserIdAndEmail(userId: string, email: string): Promise<unknown[]>;
  getPendingCount(userId: string): Promise<number>;
}
