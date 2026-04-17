/**
 * Notification Domain Model
 *
 * Rich domain entity representing a push/email notification.
 */

export type NotificationType = 'debt_created' | 'debt_confirmed' | 'debt_paid' | 'debt_disputed' | 'system';

export class Notification {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly body: string,
    public readonly data?: Record<string, any>,
    public readonly relatedResourceId?: string,
    public readonly isRead: boolean = false,
    public readonly readAt?: Date,
    public readonly createdAt: Date = new Date()
  ) {}

  /**
   * Mark notification as read
   */
  markAsRead(): Notification {
    return new Notification(
      this.id,
      this.userId,
      this.type,
      this.title,
      this.body,
      this.data,
      this.relatedResourceId,
      true,
      new Date(),
      this.createdAt
    );
  }

  /**
   * Check if notification is unread
   */
  isUnread(): boolean {
    return !this.isRead;
  }

  /**
   * Get notification age in seconds
   */
  getAgeSeconds(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / 1000);
  }

  /**
   * Check if notification is recent (< 24 hours old)
   */
  isRecent(): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
  }
}
