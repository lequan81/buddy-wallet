import { injectable, inject } from 'tsyringe';
import { eq, and, count, desc } from '@repo/db';
import { emailVerifications, type EmailVerification, type DbClient } from '@repo/db';
import type { EmailVerificationRepositoryInterface } from '../Contracts/EmailVerificationRepositoryInterface';

@injectable()
export class EmailVerificationRepository implements EmailVerificationRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async create(data: Omit<EmailVerification, 'createdAt' | 'verified' | 'attempts' | 'lastSentAt' | 'maxAttempts'> & { maxAttempts?: number }): Promise<EmailVerification> {
    const now = new Date();
    const [created] = await this.db
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
    const result = await this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email)))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1)
      .get();
    return (result as any as EmailVerification) || null;
  }

  async updateAttempts(id: string, attempts: number): Promise<void> {
    await this.db
      .update(emailVerifications)
      .set({ attempts })
      .where(eq(emailVerifications.id, id));
  }

  async markVerified(id: string): Promise<void> {
    await this.db
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.id, id));
  }

  async findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]> {
    return (await this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email)))
      .all()) as EmailVerification[];
  }

  async findLatestUnverified(email: string): Promise<EmailVerification | null> {
    const result = await this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.email, email), eq(emailVerifications.verified, false)))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1)
      .get();
    return (result as any as EmailVerification) || null;
  }

  async invalidateExisting(userId: string, email: string): Promise<void> {
    await this.db
      .update(emailVerifications)
      .set({ verified: true })
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email), eq(emailVerifications.verified, false)));
  }

  async getPendingCount(userId: string): Promise<number> {
    const result: any = await this.db
      .select({ count: count() })
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.verified, false)))
      .get();
    return result?.count ?? 0;
  }
}

