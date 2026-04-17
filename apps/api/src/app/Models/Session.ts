/**
 * Session Domain Model
 *
 * Rich domain entity representing an authenticated user session.
 */

export class Session {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly token: string,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    public readonly createdAt: Date = new Date(),
    public readonly lastActivityAt: Date = new Date(),
    public readonly revokedAt?: Date
  ) {}

  /**
   * Check if session is active (not expired/revoked)
   */
  isActive(): boolean {
    const now = new Date();
    return !this.revokedAt && this.expiresAt > now;
  }

  /**
   * Check if session has expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if session was revoked
   */
  isRevoked(): boolean {
    return !!this.revokedAt;
  }

  /**
   * Revoke the session
   */
  revoke(): Session {
    return new Session(
      this.id,
      this.userId,
      this.token,
      this.ipAddress,
      this.userAgent,
      this.expiresAt,
      this.createdAt,
      this.lastActivityAt,
      new Date()
    );
  }

  /**
   * Get session time to live (milliseconds)
   */
  getTimeToLive(): number {
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }

  /**
   * Check if session is stale (last activity > 1 hour ago)
   */
  isStale(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.lastActivityAt < oneHourAgo;
  }
}
