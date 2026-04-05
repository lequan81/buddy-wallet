import { eq, and, desc, count, emailVerifications, type EmailVerification } from '@repo/db';
import type { IEmailVerificationRepository } from '@/types/repositories';
import type { DbClient } from '@/types';

export class DrizzleEmailVerificationRepository implements IEmailVerificationRepository {
  constructor(private readonly db: DbClient) {}

  async invalidateExisting(userId: string, email: string): Promise<void> {
    await this.db
      .update(emailVerifications)
      .set({ verified: true })
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.email, email),
          eq(emailVerifications.verified, false)
        )
      );
  }

  async create(data: Omit<EmailVerification, 'createdAt' | 'lastSentAt'>): Promise<void> {
    const now = new Date();
    await this.db.insert(emailVerifications).values({
      ...data,
      lastSentAt: now,
      createdAt: now
    });
  }

  async findLatestUnverified(email: string): Promise<EmailVerification | null> {
    return (
      (await this.db
        .select()
        .from(emailVerifications)
        .where(and(eq(emailVerifications.email, email), eq(emailVerifications.verified, false)))
        .orderBy(desc(emailVerifications.createdAt))
        .get()) || null
    );
  }

  async updateAttempts(id: string, attempts: number): Promise<void> {
    await this.db.update(emailVerifications).set({ attempts }).where(eq(emailVerifications.id, id));
  }

  async markVerified(id: string): Promise<void> {
    await this.db.update(emailVerifications).set({ verified: true }).where(eq(emailVerifications.id, id));
  }

  async findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]> {
    return this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email)))
      .all();
  }

  async getPendingCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.verified, false)))
      .get();
    return result?.count ?? 0;
  }
}
