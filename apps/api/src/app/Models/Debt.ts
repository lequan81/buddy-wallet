/**
 * Debt Domain Model
 *
 * Rich domain entity with embedded business logic.
 * Replaces the state machine pattern with methods on the entity.
 *
 * Principles:
 * - Single Responsibility: Encapsulates all debt state transitions and validation
 * - Tell, Don't Ask: Business rules live here, not in services
 * - Immutability: Creates new instances on state change
 */

import type { DebtStatus } from '@repo/types';

export class Debt {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly debtorId: string | null,
    public readonly creditorId: string | null,
    private _status: DebtStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date = new Date(),
    public readonly description?: string
  ) {}

  /**
   * Get current debt status
   */
  get status(): DebtStatus {
    return this._status;
  }

  /**
   * Check if debt can be cancelled by a specific user
   * Only creditor can cancel pending debts
   */
  canBeCancelledBy(userId: string): boolean {
    return this.creditorId === userId && this._status === 'pending';
  }

  /**
   * Check if debt can be confirmed by a specific user
   * Only debtor can confirm pending debts
   */
  canBeConfirmedBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'pending';
  }

  /**
   * Check if debt can be disputed by a specific user
   * Only debtor can dispute pending debts
   */
  canBeDisputedBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'pending';
  }

  /**
   * Check if debt can be marked as paid by a specific user
   * Only debtor can pay confirmed debts
   */
  canBePaidBy(userId: string): boolean {
    return this.debtorId === userId && this._status === 'confirmed';
  }

  /**
   * Cancel the debt (creditor initiated)
   * @throws Error if debt cannot be cancelled
   */
  cancel(userId: string): Debt {
    if (!this.canBeCancelledBy(userId)) {
      throw new Error('Debt cannot be cancelled');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'cancelled',
      this.createdAt,
      new Date(),
      this.description
    );
  }

  /**
   * Confirm the debt (debtor initiated)
   * @throws Error if debt cannot be confirmed
   */
  confirm(userId: string): Debt {
    if (!this.canBeConfirmedBy(userId)) {
      throw new Error('Debt cannot be confirmed');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'confirmed',
      this.createdAt,
      new Date(),
      this.description
    );
  }

  /**
   * Dispute the debt (debtor initiated)
   * @throws Error if debt cannot be disputed
   */
  dispute(userId: string): Debt {
    if (!this.canBeDisputedBy(userId)) {
      throw new Error('Debt cannot be disputed');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'disputed',
      this.createdAt,
      new Date(),
      this.description
    );
  }

  /**
   * Mark debt as paid (debtor initiated)
   * @throws Error if debt cannot be marked as paid
   */
  markAsPaid(userId: string): Debt {
    if (!this.canBePaidBy(userId)) {
      throw new Error('Debt cannot be marked as paid');
    }
    return new Debt(
      this.id,
      this.amount,
      this.currency,
      this.debtorId,
      this.creditorId,
      'paid',
      this.createdAt,
      new Date(),
      this.description
    );
  }

  /**
   * Check if debt is overdue
   * Pending debts older than 30 days are overdue
   */
  isOverdue(): boolean {
    const daysSinceCreated =
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return this._status === 'pending' && daysSinceCreated > 30;
  }

  /**
   * Get debt direction from the perspective of a user
   * @returns 'owed' if user is creditor, 'owing' if debtor, null otherwise
   */
  getDirectionForUser(userId: string): 'owed' | 'owing' | null {
    if (this.creditorId === userId) return 'owed';
    if (this.debtorId === userId) return 'owing';
    return null;
  }

  /**
   * Get all possible next states for current status
   */
  getPossibleTransitions(): DebtStatus[] {
    switch (this._status) {
      case 'pending':
        return ['confirmed', 'disputed', 'cancelled'];
      case 'confirmed':
        return ['paid'];
      case 'disputed':
        return ['confirmed', 'cancelled'];
      case 'paid':
        return [];
      case 'cancelled':
        return [];
      default:
        return [];
    }
  }

  /**
   * Check if debt is in a final state (paid or cancelled)
   */
  isFinalized(): boolean {
    return this._status === 'paid' || this._status === 'cancelled';
  }
}

