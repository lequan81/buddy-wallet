/**
 * Core Activity Types
 */
export interface Activity {
  id: string;
  userId: string;
  type: string;
  entityId: string | null;
  entityType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
}
