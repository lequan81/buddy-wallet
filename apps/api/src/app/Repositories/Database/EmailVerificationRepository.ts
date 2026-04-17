import { injectable, inject } from 'tsyringe';
import { eq, and, count, desc } from '@repo/db';
import { emailVerifications, type EmailVerification, type DbClient } from '@repo/db';
import type { EmailVerificationRepositoryInterface } from '../Contracts/EmailVerificationRepositoryInterface';

@injectable()
export class EmailVerificationRepository implements EmailVerificationRepositoryInterface {
  constructor(
    @inject('Database') private db: DbClient
  ) {}

  async create(data: Omit<EmailVerification, 'createdAt' | 'updatedAt' | 'verified' | 'attempts'>): Promise<EmailVerification> {
    const [created] = await this.db
      .insert(emailVerifications)
      .values({
        ...data,
        verified: false,
        attempts: 0,
        updatedAt: new Date()
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
    return (result as EmailVerification) || null;
  }

  async updateAttempts(id: string, attempts: number): Promise<void> {
    await this.db
      .update(emailVerifications)
      .set({ attempts, updatedAt: new Date() })
      .where(eq(emailVerifications.id, id));
  }

  async markVerified(id: string): Promise<void> {
    await this.db
      .update(emailVerifications)
      .set({ verified: true, updatedAt: new Date() })
      .where(eq(emailVerifications.id, id));
  }

  async findAllByUserIdAndEmail(userId: string, email: string): Promise<EmailVerification[]> {
    return (await this.db
      .select()
      .from(emailVerifications)
      .where(and(eq(emailVerifications.userId, userId), eq(emailVerifications.email, email)))
      .all()) as EmailVerification[];
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
