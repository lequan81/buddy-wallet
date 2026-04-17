/**
 * Activity Domain Model
 *
 * Rich domain entity representing an audit log entry for user actions.
 */

export interface ActivityChanges {
  before?: Record<string, any>;
  after?: Record<string, any>;
}

export class Activity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly action: string,
    public readonly resource: string,
    public readonly resourceId: string,
    public readonly changes?: ActivityChanges,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly createdAt: Date = new Date()
  ) {}

  /**
   * Get human-readable action description
   */
  getDescription(): string {
    return `${this.action} ${this.resource} #${this.resourceId}`;
  }

  /**
   * Check if activity involved changes to data
   */
  hasChanges(): boolean {
    return !!(this.changes && (this.changes.before || this.changes.after));
  }

  /**
   * Get what changed
   */
  getChangedFields(): string[] {
    if (!this.changes) return [];

    const before = this.changes.before || {};
    const after = this.changes.after || {};
    const fields = new Set<string>();

    Object.keys(before).forEach((key) => fields.add(key));
    Object.keys(after).forEach((key) => fields.add(key));

    return Array.from(fields);
  }
}
