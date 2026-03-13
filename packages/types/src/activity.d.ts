export interface ActivityLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> } | Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}
