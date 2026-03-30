import type { Session as DBSession } from '@repo/db';

export interface ISessionRepository {
  findById(id: string): Promise<DBSession | null>;
  findByTokenHash(hash: string): Promise<DBSession | null>;
  findAllByUserId(userId: string): Promise<DBSession[]>;
  create(data: Omit<DBSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<DBSession>;
  update(id: string, data: Partial<DBSession>): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number>;
  deleteExpired(before: Date): Promise<number>;
}
