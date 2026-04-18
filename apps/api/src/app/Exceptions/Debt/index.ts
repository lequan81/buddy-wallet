/**
 * Debt Domain Exceptions
 *
 * Domain-specific exception classes for Debt-related errors
 */

import { NotFoundException, ForbiddenException, ConflictException } from '../index';

/**
 * Debt not found
 */
export class DebtNotFoundException extends NotFoundException {
  constructor(debtId: string) {
    super('Debt', debtId);
    this.code = 'DEBT_NOT_FOUND';
    this.name = 'DebtNotFoundException';
  }
}

/**
 * Debt operation not allowed in current state
 */
export class DebtCannotBeCancelledException extends ForbiddenException {
  constructor() {
    super('Debt has already been cancelled or confirmed', 'DEBT_CANNOT_BE_CANCELLED');
    this.name = 'DebtCannotBeCancelledException';
  }
}

/**
 * User does not have permission to perform debt operation
 */
export class DebtUnauthorizedAccessException extends ForbiddenException {
  constructor(reason?: string) {
    super(
      reason || 'You do not have permission to perform this action on this debt',
      'DEBT_UNAUTHORIZED_ACCESS'
    );
    this.name = 'DebtUnauthorizedAccessException';
  }
}

/**
 * Debt already confirmed (status transition conflict)
 */
export class DebtAlreadyConfirmedException extends ConflictException {
  constructor(debtId: string) {
    super(`Debt ${debtId} has already been confirmed`, 'DEBT_ALREADY_CONFIRMED');
    this.name = 'DebtAlreadyConfirmedException';
  }
}

/**
 * Debt already cancelled (status transition conflict)
 */
export class DebtAlreadyCancelledException extends ConflictException {
  constructor(debtId: string) {
    super(`Debt ${debtId} has already been cancelled`, 'DEBT_ALREADY_CANCELLED');
    this.name = 'DebtAlreadyCancelledException';
  }
}
