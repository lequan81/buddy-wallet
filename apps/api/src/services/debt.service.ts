/**
 * Debt Service (Class-based with Dependency Injection)
 *
 * Handles debt CRUD operations and status transitions.
 * Uses constructor injection for testability.
 * Implements IDebtService interface for LSP compliance.
 * Uses State Machine pattern for status transitions (OCP compliance).
 */
import {
  debts,
  users,
  eq,
  or,
  and,
  ne,
  gte,
  desc,
  count,
  isNull,
  type Debt,
  type ActivityAction
} from '@repo/db';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import { normalizePhoneNumber } from '../utils/phone';
// import { configs } from '../configs'; // Deprecated local config usage for limits
import {
  DEBT_MIN_AMOUNT,
  DEBT_MAX_AMOUNT,
  MAX_PENDING_DEBTS,
  MAX_BATCH_DELETE_SIZE,
  DUPLICATE_CHECK_DAYS,
  DUPLICATE_AMOUNT_TOLERANCE
} from '@repo/config';
import { CreateDebtInputSchema, safeParse } from '@repo/validation';
import { debtStateMachine } from '../states';
import { logger } from '@repo/logger';
import type { DbClient } from '../types';
import type { DebtStatus, CreateDebtInput, DebtResult, StatusUpdateResult } from '../types';
import type { IDebtService, CurrentUser } from '../types';
import type { ExpiryOption, PaginationOptions, PaginatedResult } from '../types';
import type { PushService } from './push.service';
import type { ActivityService } from './activity.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS: Record<Exclude<ExpiryOption, 'never'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

// Calculate expiry date from option
function calculateExpiryDate(option: ExpiryOption): Date | null {
  if (option === 'never') return null;
  const days = EXPIRY_DAYS[option];
  if (!days) return null;
  return new Date(Date.now() + days * MS_PER_DAY);
}

/** Push notification payload shape */
interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * DebtService class with dependency injection
 * Implements IDebtService for LSP compliance
 * Uses State Machine for status transitions (OCP compliance)
 */
export class DebtService implements IDebtService {
  private pushService: PushService | null = null;

  /**
   * Set the push service for sending notifications
   * This allows lazy initialization to avoid circular dependencies
   */
  setPushService(pushService: PushService) {
    this.pushService = pushService;
  }

  private activityService: ActivityService | null = null;

  setActivityService(activityService: ActivityService) {
    this.activityService = activityService;
  }
  constructor(private db: DbClient) {}

  // ── Private Helpers ──────────────────────────────────────────────

  /** Fetch a debt by ID or return a NOT_FOUND error */
  private async getDebtOrFail(debtId: string): Promise<[Debt, null] | [null, DebtResult]> {
    const debt = await this.db.query.debts.findFirst({
      where: and(eq(debts.id, debtId), isNull(debts.deletedAt))
    });
    if (!debt) return [null, { success: false, error: 'Debt not found', code: 'NOT_FOUND' }];
    return [debt as Debt, null];
  }

  /** Validate amount bounds, returns error result or null */
  private validateAmount(amount: number): DebtResult | null {
    if (amount < DEBT_MIN_AMOUNT) {
      return {
        success: false,
        error: `Minimum debt amount is ${DEBT_MIN_AMOUNT}`,
        code: 'AMOUNT_TOO_LOW'
      };
    }
    if (amount > DEBT_MAX_AMOUNT) {
      return {
        success: false,
        error: `Maximum debt amount is ${DEBT_MAX_AMOUNT}`,
        code: 'AMOUNT_TOO_HIGH'
      };
    }
    return null;
  }

  /** Send push notification (fire-and-forget, never throws) */
  private async notifyUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.pushService) return;
    try {
      await this.pushService.sendToUser(userId, payload);
    } catch (error) {
      logger.error('Failed to send notification', { error: String(error) });
    }
  }

  /** Log an activity event (fire-and-forget) */
  private async logActivity(
    userId: string,
    action: ActivityAction,
    resourceId?: string,
    changes?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.activityService) return;
    await this.activityService.log({
      userId,
      action,
      resource: 'debt',
      ...(resourceId && { resourceId }),
      ...(changes && { changes }),
      ...(metadata && { metadata })
    });
  }

  // ── Query Methods ──────────────────────────────────────────────

  /**
   * Find potential duplicate debts
   * Checks for debts with same parties and similar amount
   */
  async findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]> {
    const cutoffDate = new Date(Date.now() - DUPLICATE_CHECK_DAYS * MS_PER_DAY);
    const amountRange = amount * DUPLICATE_AMOUNT_TOLERANCE;

    const duplicates = this.db
      .select({
        id: debts.id,
        amount: debts.amount,
        description: debts.description,
        createdAt: debts.createdAt
      })
      .from(debts)
      .where(
        and(
          eq(debts.debtorPhone, debtorPhone),
          eq(debts.creditorPhone, creditorPhone),
          gte(debts.amount, amount - amountRange),
          gte(debts.createdAt, cutoffDate),
          ne(debts.status, 'cancelled'),
          isNull(debts.deletedAt)
        )
      )
      .all();

    return duplicates.filter((d) => d.amount <= amount + amountRange);
  }

  /** Shared paginated query builder */
  private queryDebts(
    baseWhere: ReturnType<typeof or> | undefined,
    options: PaginationOptions = {}
  ): PaginatedResult<Debt> {
    const { limit = 50, offset = 0, status } = options;

    // Build where: base filter + status + soft-delete
    let where = baseWhere;
    if (status && status !== 'all') {
      const statusCond = eq(debts.status, status);
      where = where ? and(where, statusCond) : statusCond;
    }
    where = where ? and(where, isNull(debts.deletedAt)) : isNull(debts.deletedAt);

    const countResult = where
      ? this.db.select({ count: count() }).from(debts).where(where).get()
      : this.db.select({ count: count() }).from(debts).get();
    const total = countResult?.count ?? 0;

    let query = this.db.select().from(debts);
    if (where) query = query.where(where) as typeof query;
    const data = query.orderBy(desc(debts.createdAt)).limit(limit).offset(offset).all();

    return { data, total, limit, offset };
  }

  /** Get debts for a user (or all debts if admin) with pagination */
  async getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Debt>> {
    const baseWhere = hasViewAllPermission
      ? undefined
      : or(eq(debts.debtorId, userId), eq(debts.creditorId, userId));
    return this.queryDebts(baseWhere, options);
  }

  /** Get debts for a specific user (admin only) with pagination */
  async getDebtsByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Debt>> {
    return this.queryDebts(or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)), options);
  }

  /**
   * Count active debts for a phone number (public lookup)
   * Active = status NOT 'paid' or 'cancelled'
   */
  async countActiveDebtsForPhone(phone: string): Promise<number> {
    const result = this.db
      .select({ count: count() })
      .from(debts)
      .where(
        and(
          or(eq(debts.debtorPhone, phone), eq(debts.creditorPhone, phone)),
          and(ne(debts.status, 'paid'), ne(debts.status, 'cancelled')),
          isNull(debts.deletedAt)
        )
      )
      .get();

    return result?.count ?? 0;
  }

  /**
   * Get a single debt by ID
   */
  async getDebtById(debtId: string) {
    return this.db.query.debts.findFirst({
      where: and(eq(debts.id, debtId), isNull(debts.deletedAt))
    });
  }

  /**
   * Get recent contacts for a user (phone numbers they've interacted with)
   * Returns unique phone numbers from recent debts, sorted by most recent
   */
  async getRecentContacts(userId: string, limit: number = 10): Promise<string[]> {
    // Get all debts involving this user, ordered by most recent
    const userDebts = this.db
      .select({
        debtorPhone: debts.debtorPhone,
        creditorPhone: debts.creditorPhone,
        createdAt: debts.createdAt
      })
      .from(debts)
      .where(or(eq(debts.debtorId, userId), eq(debts.creditorId, userId)))
      .orderBy(debts.createdAt)
      .all();

    // Get user's phone number
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { phoneNumber: true }
    });
    const myPhone = user?.phoneNumber;

    // Extract unique counterparty phones, excluding self
    const seenPhones = new Set<string>();
    const contacts: string[] = [];

    // Iterate in reverse (most recent first)
    for (let i = userDebts.length - 1; i >= 0 && contacts.length < limit; i--) {
      const d = userDebts[i];
      const counterpartyPhone = d.debtorPhone !== myPhone ? d.debtorPhone : d.creditorPhone;

      if (counterpartyPhone && !seenPhones.has(counterpartyPhone)) {
        seenPhones.add(counterpartyPhone);
        contacts.push(counterpartyPhone);
      }
    }

    return contacts;
  }

  /**
   * Create a new debt
   * @param input - Debt creation data
   * @param currentUser - The user creating the debt
   * @param options - Additional options (expiryOption, confirmDuplicate)
   */
  async createDebt(
    input: CreateDebtInput,
    currentUser: CurrentUser,
    options?: { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }
  ): Promise<DebtResult> {
    if (!currentUser.phoneNumber) {
      return {
        success: false,
        error: 'Please update your profile with a phone number to create debts.',
        code: 'PHONE_REQUIRED'
      };
    }

    // Validate input using shared schema
    const parseResult = safeParse(CreateDebtInputSchema, input);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.issues[0].message,
        code: 'VALIDATION_ERROR'
      };
    }
    const { amount, description, phoneNumber, direction } = parseResult.output;

    // Normalize counterparty phone
    const normalizedCounterpartyPhone = normalizePhoneNumber(phoneNumber);
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

    // Check unconfirmed debt limit (anti-abuse)
    const pendingCountResult = this.db
      .select({ value: count() })
      .from(debts)
      .where(and(eq(debts.creditorId, currentUser.id), eq(debts.needsConfirmation, true)))
      .get();
    if (pendingCountResult && pendingCountResult.value >= MAX_PENDING_DEBTS) {
      return {
        success: false,
        error: `Too many unconfirmed debts (max ${MAX_PENDING_DEBTS}). Wait for debtors to confirm existing debts.`,
        code: 'PENDING_DEBT_LIMIT'
      };
    }

    // Check for potential duplicates (unless confirmDuplicate is set)
    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === 'LEND' ? normalizedCounterpartyPhone : normalizedUserPhone!;
      const creditorPhone =
        direction === 'LEND' ? normalizedUserPhone! : normalizedCounterpartyPhone;

      const duplicates = await this.findPotentialDuplicates(debtorPhone, creditorPhone, amount);

      if (duplicates.length > 0) {
        return {
          success: false,
          error: 'Potential duplicate debt found',
          code: 'DUPLICATE_WARNING',
          duplicates
        } as DebtResult;
      }
    }

    // Find counterparty user if they exist
    const counterparty = await this.db.query.users.findFirst({
      where: eq(users.phoneNumber, normalizedCounterpartyPhone)
    });

    // Calculate expiry date
    const expiresAt = calculateExpiryDate(options?.expiryOption || 'never');

    const now = new Date();
    const entry = {
      id: crypto.randomUUID(),
      amount,
      description,
      status: 'confirmed' as const,
      uploadedById: currentUser.id,
      confirmedByCreditor: direction === 'LEND',
      confirmedByDebtor: direction === 'BORROW',
      needsConfirmation: true,
      creditorConfirmedAt: direction === 'LEND' ? now : null,
      debtorConfirmedAt: direction === 'BORROW' ? now : null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
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

    await this.logActivity(currentUser.id, 'create', entry.id, {
      after: { amount: entry.amount, description: entry.description }
    });

    // Send push notification to counterparty if they're a registered user
    if (counterparty && this.pushService) {
      try {
        await this.pushService.sendDebtCreatedNotification({
          userId: counterparty.id,
          creatorName: currentUser.phoneNumber || 'Someone',
          amount: entry.amount,
          description: entry.description || 'No description',
          debtId: entry.id,
          isCreditor: direction === 'BORROW'
        });
      } catch (error) {
        logger.error('Failed to send debt notification', { error: String(error) });
      }
    }

    return { 
      success: true, 
      debt: {
        ...entry,
        hasPendingProof: false,
        proofCount: 0,
        lastProofUploadedAt: null,
        suggestedAmount: null,
        suggestedDescription: null,
        suggestedById: null,
        suggestedAt: null,
        deletedAt: null
      }
    };
  }

  /**
   * Confirm a debt by counterparty
   * Only the counterparty (not the creator) can confirm
   */
  async confirmDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;

    if (!isCreditor && !isDebtor) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }

    if (debt.uploadedById === currentUser.id) {
      return {
        success: false,
        error:
          'You created this debt and have already confirmed it. Waiting for counterparty confirmation.',
        code: 'ALREADY_CONFIRMED'
      };
    }

    if ((isCreditor && debt.confirmedByCreditor) || (isDebtor && debt.confirmedByDebtor)) {
      return { success: true, debt, message: 'You already confirmed this debt' };
    }

    const now = new Date();
    const updates: Partial<typeof debt> = { updatedAt: now };

    if (isCreditor) {
      updates.confirmedByCreditor = true;
      updates.creditorConfirmedAt = now;
    }
    if (isDebtor) {
      updates.confirmedByDebtor = true;
      updates.debtorConfirmedAt = now;
    }

    const willBeFullyConfirmed =
      (updates.confirmedByCreditor || debt.confirmedByCreditor) &&
      (updates.confirmedByDebtor || debt.confirmedByDebtor);
    if (willBeFullyConfirmed) updates.needsConfirmation = false;

    await this.db.update(debts).set(updates).where(eq(debts.id, debtId));

    const updatedDebt = await this.db.query.debts.findFirst({ where: eq(debts.id, debtId) });

    // Send notification to the creator
    if (this.pushService && debt.uploadedById) {
      try {
        await this.pushService.sendDebtConfirmedNotification({
          userId: debt.uploadedById,
          confirmerName: currentUser.phoneNumber || 'Counterparty',
          amount: debt.amount,
          description: debt.description || 'No description',
          debtId
        });
      } catch (error) {
        logger.error('Failed to send confirmation notification', { error: String(error) });
      }
    }

    await this.logActivity(currentUser.id, 'confirm', debtId);

    return { success: true, debt: updatedDebt, message: 'Debt confirmed successfully' };
  }

  /**
   * Update debt status with transition validation
   * Uses State Machine pattern for OCP compliance
   */
  async updateDebtStatus(
    debtId: string,
    newStatus: DebtStatus,
    currentUser: CurrentUser
  ): Promise<StatusUpdateResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    const isInvolved = debt.debtorId === currentUser.id || debt.creditorId === currentUser.id;
    if (!isAdmin && !isInvolved) {
      return { success: false, error: 'You are not a party to this debt' };
    }

    const now = new Date();
    const transitionResult = await debtStateMachine.transition(debt as Debt, newStatus, {
      userId: currentUser.id,
      permissions: currentUser.permissions,
      timestamp: now
    });

    if (!transitionResult.success) {
      return {
        success: false,
        error: transitionResult.error,
        code: transitionResult.code,
        validTransitions: transitionResult.validTransitions
      };
    }

    await this.db
      .update(debts)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(debts.id, debtId));
    const updatedDebt = await this.db.query.debts.findFirst({ where: eq(debts.id, debtId) });

    await this.logActivity(currentUser.id, newStatus, debtId, {
      before: { status: debt.status },
      after: { status: newStatus }
    });

    return { success: true, debt: updatedDebt, previousStatus: debt.status, newStatus };
  }

  /**
   * Update debt details (description, amount)
   * Can only update if status is 'pending' or 'disputed'
   */
  async updateDebt(
    debtId: string,
    data: { description?: string; amount?: number },
    currentUser: CurrentUser
  ): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only edit debts you created', code: 'FORBIDDEN' };
    }

    if (!['pending', 'disputed'].includes(debt.status)) {
      return {
        success: false,
        error: `Cannot edit debt with status '${debt.status}'. Only pending or disputed debts can be edited.`,
        code: 'INVALID_STATUS'
      };
    }

    if (data.amount !== undefined) {
      const amountErr = this.validateAmount(data.amount);
      if (amountErr) return amountErr;
    }

    const now = new Date();
    await this.db
      .update(debts)
      .set({
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: data.amount }),
        updatedAt: now
      })
      .where(eq(debts.id, debtId));

    const updatedDebt = await this.db.query.debts.findFirst({ where: eq(debts.id, debtId) });
    await this.logActivity(currentUser.id, 'update', debtId, { after: data });

    return { success: true, debt: updatedDebt };
  }

  /** Soft delete a single debt */
  async deleteDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only delete debts you created', code: 'FORBIDDEN' };
    }

    const now = new Date();
    await this.db.update(debts).set({ deletedAt: now, updatedAt: now }).where(eq(debts.id, debtId));
    await this.logActivity(currentUser.id, 'delete', debtId);

    return { success: true };
  }

  /**
   * Soft delete multiple debts
   */
  async deleteDebts(
    debtIds: string[],
    currentUser: CurrentUser
  ): Promise<{ success: boolean; deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deletedCount = 0;

    if (debtIds.length > MAX_BATCH_DELETE_SIZE) {
      return {
        success: false,
        deleted: 0,
        errors: [`Maximum ${MAX_BATCH_DELETE_SIZE} debts can be deleted at once`]
      };
    }

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    const now = new Date();

    for (const debtId of debtIds) {
      const debt = await this.db.query.debts.findFirst({ where: eq(debts.id, debtId) });

      if (!debt) {
        errors.push(`Debt ${debtId} not found`);
        continue;
      }

      if (!isAdmin && debt.uploadedById !== currentUser.id) {
        errors.push(`Not authorized to delete debt ${debtId}`);
        continue;
      }

      await this.db
        .update(debts)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(debts.id, debtId));
      deletedCount++;
    }

    if (deletedCount > 0) {
      await this.logActivity(currentUser.id, 'delete', undefined, undefined, {
        deletedCount,
        ids: debtIds
      });
    }

    return { success: errors.length === 0, deleted: deletedCount, errors };
  }

  /** Suggest an edit to a debt (counterparty can suggest changes) */
  async suggestEdit(
    debtId: string,
    currentUser: CurrentUser,
    suggestion: { amount?: number; description?: string }
  ): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;

    if (!isCreditor && !isDebtor) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }
    if (debt.uploadedById === currentUser.id) {
      return {
        success: false,
        error: 'Creators cannot suggest edits to their own debts',
        code: 'FORBIDDEN'
      };
    }
    if (debt.status === 'paid' || debt.status === 'cancelled') {
      return {
        success: false,
        error: 'Cannot suggest edits to completed debts',
        code: 'INVALID_STATE'
      };
    }
    if (!suggestion.amount && !suggestion.description) {
      return {
        success: false,
        error: 'Must provide at least amount or description to suggest',
        code: 'VALIDATION_ERROR'
      };
    }

    if (suggestion.amount !== undefined) {
      const amountErr = this.validateAmount(suggestion.amount);
      if (amountErr) return amountErr;
    }

    const now = new Date();
    await this.db
      .update(debts)
      .set({
        suggestedAmount: suggestion.amount ?? null,
        suggestedDescription: suggestion.description ?? null,
        suggestedById: currentUser.id,
        suggestedAt: now,
        updatedAt: now
      })
      .where(eq(debts.id, debtId));

    if (debt.uploadedById) {
      await this.notifyUser(debt.uploadedById, {
        title: 'Edit Suggested',
        body: `Someone suggested changes to your debt of ${debt.amount.toLocaleString()} VND`,
        url: `/debts/${debtId}`
      });
    }

    const updatedDebt = await this.db.query.debts.findFirst({ where: eq(debts.id, debtId) });
    return { success: true, debt: updatedDebt, message: 'Edit suggestion sent' };
  }

  /** Accept or reject a suggested edit */
  async respondToSuggestion(
    debtId: string,
    currentUser: CurrentUser,
    accept: boolean
  ): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    if (debt.uploadedById !== currentUser.id) {
      return {
        success: false,
        error: 'Only the creator can respond to edit suggestions',
        code: 'FORBIDDEN'
      };
    }
    if (!debt.suggestedById) {
      return { success: false, error: 'No pending suggestion', code: 'INVALID_STATE' };
    }

    const now = new Date();
    const clearSuggestion = {
      suggestedAmount: null,
      suggestedDescription: null,
      suggestedById: null,
      suggestedAt: null,
      updatedAt: now
    };
    const updates = accept
      ? {
          ...clearSuggestion,
          amount: debt.suggestedAmount ?? debt.amount,
          description: debt.suggestedDescription ?? debt.description
        }
      : clearSuggestion;

    await this.db.update(debts).set(updates).where(eq(debts.id, debtId));

    if (debt.suggestedById) {
      await this.notifyUser(debt.suggestedById, {
        title: accept ? 'Edit Accepted' : 'Edit Rejected',
        body: accept ? 'Your suggested edit was accepted' : 'Your suggested edit was rejected',
        url: `/debts/${debtId}`
      });
    }

    const updatedDebt = await this.db.query.debts.findFirst({ where: eq(debts.id, debtId) });
    return {
      success: true,
      debt: updatedDebt,
      message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
    };
  }

  /** Delete all debts for a user */
  async deleteAllDebts(userId: string): Promise<{ success: boolean; deleted: number }> {
    const userDebts = await this.db.query.debts.findMany({
      where: eq(debts.uploadedById, userId)
    });

    if (userDebts.length === 0) return { success: true, deleted: 0 };

    const now = new Date();
    await this.db
      .update(debts)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(debts.uploadedById, userId));

    return { success: true, deleted: userDebts.length };
  }
}
