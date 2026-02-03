/**
 * Debt Service (Class-based with Dependency Injection)
 *
 * Handles debt CRUD operations and status transitions.
 * Uses constructor injection for testability.
 */
import { debts, users, eq, or, and, ne } from '@repo/db';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import { normalizePhoneNumber } from '@/utils/phone';
import { configs } from '@/configs';
import type { DbClient } from '@/types';
import type {
  DebtStatus,
  DebtDirection,
  CreateDebtInput,
  DebtResult,
  StatusUpdateResult
} from '@/types';

// Valid debt status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'disputed', 'cancelled'],
  confirmed: ['paid', 'disputed'],
  disputed: ['pending', 'confirmed', 'cancelled'],
  paid: [], // Terminal state
  cancelled: [] // Terminal state
};

interface CurrentUser {
  id: string;
  phoneNumber: string | null;
  permissions: string[];
}

/**
 * DebtService class with dependency injection
 */
export class DebtService {
  constructor(private db: DbClient) {}

  /**
   * Get debts for a user (or all debts if admin)
   */
  async getDebtsForUser(userId: string, hasViewAllPermission: boolean): Promise<any[]> {
    if (hasViewAllPermission) {
      return await this.db.select().from(debts).all();
    }

    return await this.db.query.debts.findMany({
      where: or(eq(debts.debtorId, userId), eq(debts.creditorId, userId))
    });
  }

  /**
   * Get debts for a specific user (admin only)
   */
  async getDebtsByUserId(userId: string): Promise<any[]> {
    return await this.db.query.debts.findMany({
      where: or(eq(debts.debtorId, userId), eq(debts.creditorId, userId))
    });
  }

  /**
   * Count active debts for a phone number (public lookup)
   * Active = status NOT 'paid' or 'cancelled'
   */
  async countActiveDebtsForPhone(phone: string): Promise<number> {
    const activeDebts = this.db
      .select()
      .from(debts)
      .where(
        and(
          or(eq(debts.debtorPhone, phone), eq(debts.creditorPhone, phone)),
          and(ne(debts.status, 'paid'), ne(debts.status, 'cancelled'))
        )
      )
      .all();

    return activeDebts.length;
  }

  /**
   * Get a single debt by ID
   */
  async getDebtById(debtId: string) {
    return this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });
  }

  /**
   * Create a new debt
   */
  async createDebt(input: CreateDebtInput, currentUser: CurrentUser): Promise<DebtResult> {
    if (!currentUser.phoneNumber) {
      return {
        success: false,
        error: 'Please update your profile with a phone number to create debts.',
        code: 'PHONE_REQUIRED'
      };
    }

    const { amount, description, counterpartyPhone, direction } = input;

    // Normalize counterparty phone
    const normalizedCounterpartyPhone = normalizePhoneNumber(counterpartyPhone);
    if (!normalizedCounterpartyPhone) {
      return {
        success: false,
        error: 'Invalid counterparty phone number format',
        code: 'INVALID_PHONE_FORMAT'
      };
    }

    // Prevent self-debt
    const normalizedUserPhone = normalizePhoneNumber(currentUser.phoneNumber);
    if (normalizedCounterpartyPhone === normalizedUserPhone) {
      return {
        success: false,
        error: 'Cannot create a debt with yourself',
        code: 'SELF_DEBT_NOT_ALLOWED'
      };
    }

    // Validate amount
    if (amount < configs.DEBT.MIN_AMOUNT) {
      return {
        success: false,
        error: `Minimum debt amount is ${configs.DEBT.MIN_AMOUNT}`,
        code: 'AMOUNT_TOO_LOW'
      };
    }
    if (amount > configs.DEBT.MAX_AMOUNT) {
      return {
        success: false,
        error: `Maximum debt amount is ${configs.DEBT.MAX_AMOUNT}`,
        code: 'AMOUNT_TOO_HIGH'
      };
    }

    // Find counterparty user if they exist
    const counterparty = await this.db.query.users.findFirst({
      where: eq(users.phoneNumber, normalizedCounterpartyPhone)
    });

    const entry = {
      id: crypto.randomUUID(),
      amount,
      description,
      status: 'pending' as const,
      uploadedById: currentUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      debtorId: null as string | null,
      creditorId: null as string | null,
      debtorPhone: '',
      creditorPhone: ''
    };

    if (direction === 'LEND') {
      entry.creditorId = currentUser.id;
      entry.creditorPhone = normalizedUserPhone!;
      entry.debtorPhone = normalizedCounterpartyPhone;
      if (counterparty) entry.debtorId = counterparty.id;
    } else {
      entry.debtorId = currentUser.id;
      entry.debtorPhone = normalizedUserPhone!;
      entry.creditorPhone = normalizedCounterpartyPhone;
      if (counterparty) entry.creditorId = counterparty.id;
    }

    await this.db.insert(debts).values(entry);

    return { success: true, debt: entry };
  }

  /**
   * Update debt status with transition validation
   */
  async updateDebtStatus(
    debtId: string,
    newStatus: DebtStatus,
    currentUser: CurrentUser
  ): Promise<StatusUpdateResult> {
    // Get current debt
    const debt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    if (!debt) {
      return { success: false, error: 'Debt not found' };
    }

    // Check if user is involved (unless admin)
    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    const isInvolved = debt.debtorId === currentUser.id || debt.creditorId === currentUser.id;

    if (!isAdmin && !isInvolved) {
      return { success: false, error: 'You are not a party to this debt' };
    }

    // Validate status transition
    const validTransitions = VALID_STATUS_TRANSITIONS[debt.status] || [];
    if (!validTransitions.includes(newStatus)) {
      return {
        success: false,
        error: `Cannot transition from '${debt.status}' to '${newStatus}'`,
        code: 'INVALID_STATUS_TRANSITION',
        validTransitions
      };
    }

    // Update debt status
    await this.db
      .update(debts)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(debts.id, debtId));

    return { success: true, previousStatus: debt.status, newStatus };
  }
}
