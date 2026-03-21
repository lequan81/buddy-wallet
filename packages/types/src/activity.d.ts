import type { ActivityLog as DBActivityLog } from '@repo/db';

export interface ActivityLog extends Omit<DBActivityLog, 'createdAt'> {
  createdAt: string;
}
