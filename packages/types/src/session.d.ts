export interface SessionInfo {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  location: string | null;
  ipAddress: string | null;
  lastActiveAt: Date | string | null;
  createdAt: Date | string | null;
}
