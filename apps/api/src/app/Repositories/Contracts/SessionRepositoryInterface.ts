import type { Session as DBSession } from '@repo/db';

export interface SessionRepositoryInterface {
  findById(id: string): Promise<DBSession | null>;
  findActiveByRefreshToken(hash: string): Promise<DBSession | null>;
  findActiveByUserId(userId: string): Promise<DBSession[]>;
  findActiveByIdAndUser(id: string, userId: string): Promise<DBSession | null>;
  create(data: Omit<DBSession, 'createdAt'>): Promise<void>;
  update(id: string, data: Partial<DBSession>): Promise<void>;
  revokeById(id: string, reason: string): Promise<void>;
  revokeActiveSessionsForUser(userId: string): Promise<void>;
  revokeAllForUser(userId: string, exceptSessionId?: string): Promise<DBSession[] | number>;
  revokeOthers(userId: string, currentSessionId: string, reason: string): Promise<void>;
}
