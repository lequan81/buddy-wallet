/**
 * Session Type Definitions
 */
export interface SessionInfo {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  location: string | null;
  ipAddress: string | null;
  lastActiveAt: Date | null;
  createdAt: Date | null;
}
