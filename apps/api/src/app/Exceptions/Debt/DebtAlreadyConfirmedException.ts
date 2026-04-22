import { ConflictException } from '../index';

/**
 * Debt already confirmed (status transition conflict)
 */
export class DebtAlreadyConfirmedException extends ConflictException {
  constructor(debtId: string) {
    super(`Debt ${debtId} has already been confirmed`, 'DEBT_ALREADY_CONFIRMED');
    this.name = 'DebtAlreadyConfirmedException';
  }
}
