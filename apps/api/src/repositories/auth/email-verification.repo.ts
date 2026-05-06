import { eq, and, count, desc, emailVerifications } from '@repo/db';
import type { EmailVerification, DbClient } from '@repo/db';
import { db } from '@/providers/database';

/**
 * Email Verification Repository
 * Data access layer for email verification operations
 * No DI container - uses direct db instance
 */
export class EmailVerificationRepository {
  constructor(private readonly database: DbClient = db) {}

  private normalizeOne(result: EmailVerification | undefined): EmailVerification | null {
    return result ?? null;
  }

  async create(data: Omit<EmailVerification, 'createdAt' | 'verified' | 'attempts' | 'lastSentAt' | 'maxAttempts'> & { maxAttempts?: number }): Promise<EmailVerification> {
    const now = new Date();
    const [created] = await this.database
      .insert(emailVerifications)
      .values({
        ...data,
        verified: false,
        attempts: 0,
        maxAttempts: data.maxAttempts ?? 5,
        lastSentAt: now,
        createdAt: now
      })
      .returning();
    return created as EmailVerification;
  }

  async findLatestByUserAndEmail(userId: string, email: string): Promise<EmailVerification | null> {
    const result = await this.database
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email)))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1)
      .get();

    return this.normalizeOne(result);
  }

  async updateAttempts(id: string, attempts: number): Promise<void> {
    await this.database
      .update(emailVerifications)
      .set({ attempts })
      .where(eq(emailVerifications.id, id));
  }

  async markVerified(id: string): Promise<void> {
    await this.database
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.id, id));
  }

  async findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]> {
    return (await this.database
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email)))
      .all()) as EmailVerification[];
  }

  async findLatestUnverified(email: string): Promise<EmailVerification | null> {
    const result = await this.database
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.email, email), eq(emailVerifications.verified, false)))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1)
      .get();

    return this.normalizeOne(result);
  }

  async findById(id: string): Promise<EmailVerification | null> {
    const result = await this.database
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.id, id))
      .get();

    return this.normalizeOne(result);
  }

  async findByOtpHash(otpHash: string): Promise<EmailVerification | null> {
    const result = await this.database
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.otpHash, otpHash))
      .get();

    return this.normalizeOne(result);
  }

  async invalidateExisting(userId: string, email: string): Promise<void> {
    await this.database
      .update(emailVerifications)
      .set({ verified: true })
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email), eq(emailVerifications.verified, false)));
  }

  async getPendingCount(userId: string): Promise<number> {
    const result = await this.database
      .select({ count: count() })
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.verified, false)))
      .get();
    return Number(result?.count ?? 0);
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(emailVerifications).where(eq(emailVerifications.id, id));
  }
}

