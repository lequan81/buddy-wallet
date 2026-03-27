/**
 * Debt Service — Hexagonal Architecture
 *
 * Single unified service for all debt operations.
 * Depends on IDebtRepository (port) — not concrete Drizzle ORM.
 *
 * Principles:
 * - SOLID: SRP per method, DIP via repository interface
 * - KISS: One class, clear method names
 * - DRY: Shared validators, shared utils
 * - YAGNI: No unused abstractions
 * - Fail-Fast: Zone A (validation) before Zone B (execution)
 * - ACID: Repository handles transactions
 * - Stateless: No mutable class state beyond injected dependencies
 */
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import {
  MAX_PENDING_DEBTS,
  DUPLICATE_AMOUNT_TOLERANCE,
  DUPLICATE_CHECK_DAYS,
  MAX_BATCH_DELETE_SIZE
} from '@repo/config';
import { debtStateMachine } from '@/states';
import { logger } from '@repo/logger';
import type {
  DebtStatus,
  DebtResult,
  StatusUpdateResult,
  CreateDebtInput,
  CurrentUser,
  ExpiryOption,
  PaginationOptions,
  PaginatedResult,
  DebtDetails
} from '@repo/types';
import { DEBT_STATUS, DEBT_DIRECTION } from '@repo/types';
import type { IDebtRepository, DebtEntity } from '@/repositories';
import { PushService } from '@/services/notification/push.service';
import { ActivityService } from '@/services/activity/activity.service';
import type { PushPayload } from '@/types/push.d';
import type { ActivityAction } from '@repo/db';
import { validateAmount, validateCreateDebtInput, validatePhones } from './debt.validators';
import { toDebtDetails, calculateExpiryDate } from './debt.utils';

/**
 * DebtService — All debt operations via Hexagonal Architecture.
 * Stateless: only holds injected dependencies.
 */
export class DebtServices {
  constructor(
    private readonly debtRepo: IDebtRepository,
    private readonly pushService: PushService | null = null,
    private readonly activityService: ActivityService | null = null
  ) {}

  // ── Private Helpers (fire-and-forget, never throw) ─────────────

  /** Send push notification (fire-and-forget) */
  private async notify(userId: string, payload: PushPayload): Promise<void> {
    if (!this.pushService) return;
    try {
      await this.pushService.sendToUser(userId, payload);
    } catch (error) {
      logger.error('Failed to send notification', { error: String(error) });
    }
  }

  /** Log activity (fire-and-forget) */
  private async log(
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

  /** Fetch debt or return NOT_FOUND error */
  private async getDebtOrFail(debtId: string): Promise<[DebtEntity, null] | [null, DebtResult]> {
    const debt = await this.debtRepo.findById(debtId);
    if (!debt) return [null, { success: false, error: 'Debt not found', code: 'NOT_FOUND' }];
    return [debt, null];
  }

  // ── Query Methods ─────────────────────────────────────────────

  /** Get debts for a user (or all if admin) with pagination */
  async getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<DebtDetails>> {
    const result = await this.debtRepo.findMany({
      ...options,
      involvedUserId: hasViewAllPermission ? undefined : userId
    });
    return {
      data: result.data.map(toDebtDetails),
      total: result.total,
      limit: result.limit,
      offset: result.offset
    };
  }

  /** Get debts for a specific user (admin) with pagination */
  async getDebtsByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<DebtDetails>> {
    const result = await this.debtRepo.findMany({
      ...options,
      involvedUserId: userId
    });
    return {
      data: result.data.map(toDebtDetails),
      total: result.total,
      limit: result.limit,
      offset: result.offset
    };
  }

  /** Get a single debt by ID */
  async getDebtById(debtId: string): Promise<DebtDetails | undefined> {
    const debt = await this.debtRepo.findById(debtId);
    return debt ? toDebtDetails(debt) : undefined;
  }

  /** Get recent contacts for a user */
  async getRecentContacts(userId: string, limit: number = 10): Promise<string[]> {
    return this.debtRepo.getRecentContacts(userId, limit);
  }

  /** Count active debts for a phone number (public lookup) */
  async countActiveDebtsForPhone(phone: string): Promise<number> {
    return this.debtRepo.countActiveDebtsForPhone(phone);
  }

  // ── Create ────────────────────────────────────────────────────

  /**
   * Create a new debt.
   * Zone A: All validation first (pure, no I/O).
   * Zone B: Database writes and notifications.
   */
  async createDebt(
    input: CreateDebtInput,
    currentUser: CurrentUser,
    options?: { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }
  ): Promise<DebtResult> {
    // ── Zone A: Fail-Fast Validation ──────────────────────────
    const phoneResult = validatePhones(input.counterpartyPhone, currentUser.phoneNumber);
    if (!phoneResult.success) return phoneResult.error;

    const parseResult = validateCreateDebtInput(input);
    if (!parseResult.success) return parseResult.error;

    const { amount, description, direction } = parseResult.data;

    const amountErr = validateAmount(amount);
    if (amountErr) return amountErr;

    // ── Zone B: Execution (DB queries + writes) ──────────────
    const pendingCount = await this.debtRepo.countUnconfirmedByCreditor(currentUser.id);
    if (pendingCount >= MAX_PENDING_DEBTS) {
      return {
        success: false,
        error: `Too many unconfirmed debts (max ${MAX_PENDING_DEBTS}). Wait for debtors to confirm existing debts.`,
        code: 'PENDING_DEBT_LIMIT'
      };
    }

    const { counterparty: normalizedCounterparty, user: normalizedUser } = phoneResult;

    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === DEBT_DIRECTION.LEND ? normalizedCounterparty : normalizedUser;
      const creditorPhone = direction === DEBT_DIRECTION.LEND ? normalizedUser : normalizedCounterparty;

      const duplicates = await this.debtRepo.findPotentialDuplicates(
        debtorPhone, creditorPhone, amount, DUPLICATE_AMOUNT_TOLERANCE, DUPLICATE_CHECK_DAYS
      );

      if (duplicates.length > 0) {
        return { success: false, error: 'Potential duplicate debt found', code: 'DUPLICATE_WARNING', duplicates } as DebtResult;
      }
    }

    const now = new Date();
    const entry = await this.debtRepo.create({
      id: crypto.randomUUID(),
      amount,
      description,
      status: DEBT_STATUS.PENDING,
      uploadedById: currentUser.id,
      confirmedByCreditor: direction === DEBT_DIRECTION.LEND,
      confirmedByDebtor: direction === DEBT_DIRECTION.BORROW,
      needsConfirmation: true,
      creditorConfirmedAt: direction === DEBT_DIRECTION.LEND ? now : null,
      debtorConfirmedAt: direction === DEBT_DIRECTION.BORROW ? now : null,
      expiresAt: calculateExpiryDate(options?.expiryOption || 'never'),
      createdAt: now,
      updatedAt: now,
      debtorId: direction === DEBT_DIRECTION.BORROW ? currentUser.id : null,
      creditorId: direction === DEBT_DIRECTION.LEND ? currentUser.id : null,
      debtorPhone: direction === DEBT_DIRECTION.BORROW ? normalizedUser : normalizedCounterparty,
      creditorPhone: direction === DEBT_DIRECTION.LEND ? normalizedUser : normalizedCounterparty
    });

    // Activity log (fire-and-forget)
    await this.log(currentUser.id, 'create', entry.id, { after: { amount, description } });

    // Push notification (fire-and-forget, outside critical path)
    const counterpartyId = direction === DEBT_DIRECTION.BORROW ? entry.creditorId : entry.debtorId;
    if (this.pushService && counterpartyId) {
      try {
        await this.pushService.sendDebtCreatedNotification({
          userId: counterpartyId,
          creatorName: currentUser.phoneNumber || 'Someone',
          amount: entry.amount,
          description: entry.description || 'No description',
          debtId: entry.id,
          isCreditor: direction === DEBT_DIRECTION.BORROW
        });
      } catch (error) {
        logger.error('Failed to send debt notification', { error: String(error) });
      }
    }

    return { success: true, debt: toDebtDetails(entry) };
  }

  // ── Update ────────────────────────────────────────────────────

  /** Update debt details (description, amount) */
  async updateDebt(
    debtId: string,
    data: { description?: string; amount?: number },
    currentUser: CurrentUser
  ): Promise<DebtResult> {
    // Zone A: Validate inputs
    if (data.amount !== undefined) {
      const amountErr = validateAmount(data.amount);
      if (amountErr) return amountErr;
    }

    // Zone B: Database operations
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only edit debts you created', code: 'FORBIDDEN' };
    }

    if (debt.status !== DEBT_STATUS.PENDING && debt.status !== DEBT_STATUS.DISPUTED) {
      return {
        success: false,
        error: `Cannot edit debt with status '${debt.status}'. Only pending or disputed debts can be edited.`,
        code: 'INVALID_STATUS'
      };
    }

    const now = new Date();
    const updatedDebt = await this.debtRepo.update(debtId, {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount }),
      updatedAt: now
    });

    await this.log(currentUser.id, 'update', debtId, { after: data });

    return { success: true, debt: updatedDebt ? toDebtDetails(updatedDebt) : undefined };
  }

  // ── Status Transitions ────────────────────────────────────────

  /** Update debt status with state machine validation */
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
    const transitionResult = await debtStateMachine.transition(
      debt as unknown as import('@repo/db').Debt,
      newStatus,
      { userId: currentUser.id, permissions: currentUser.permissions, timestamp: now }
    );

    if (!transitionResult.success) {
      return {
        success: false,
        error: transitionResult.error,
        code: transitionResult.code,
        validTransitions: transitionResult.validTransitions
      };
    }

    const updatedDebt = await this.debtRepo.update(debtId, { status: newStatus, updatedAt: now });

    await this.log(currentUser.id, newStatus as ActivityAction, debtId, {
      before: { status: debt.status },
      after: { status: newStatus }
    });

    return {
      success: true,
      debt: updatedDebt ? toDebtDetails(updatedDebt) : undefined,
      previousStatus: debt.status,
      newStatus
    };
  }

  /** Confirm debt by counterparty */
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
        error: 'You created this debt and have already confirmed it.',
        code: 'ALREADY_CONFIRMED'
      };
    }

    const now = new Date();
    const updates: Partial<DebtEntity> = { updatedAt: now };

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

    const updatedDebt = await this.debtRepo.update(debtId, updates as import('../../repositories').UpdateDebtData);

    await this.log(currentUser.id, 'confirm', debtId);

    // Notification (fire-and-forget)
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

    return {
      success: true,
      debt: updatedDebt ? toDebtDetails(updatedDebt) : undefined,
      message: 'Debt confirmed successfully'
    };
  }

  // ── Suggestions ───────────────────────────────────────────────

  /** Suggest an edit to a debt (counterparty only) */
  async suggestEdit(
    debtId: string,
    currentUser: CurrentUser,
    suggestion: { amount?: number; description?: string }
  ): Promise<DebtResult> {
    // Zone A: Validate inputs
    if (!suggestion.amount && !suggestion.description) {
      return {
        success: false,
        error: 'Must provide at least amount or description to suggest',
        code: 'VALIDATION_ERROR'
      };
    }

    if (suggestion.amount !== undefined) {
      const amountErr = validateAmount(suggestion.amount);
      if (amountErr) return amountErr;
    }

    // Zone B: Database operations
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    if (debt.creditorId !== currentUser.id && debt.debtorId !== currentUser.id) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }
    if (debt.uploadedById === currentUser.id) {
      return { success: false, error: 'Creators cannot suggest edits to their own debts', code: 'FORBIDDEN' };
    }
    if (debt.status === DEBT_STATUS.PAID || debt.status === DEBT_STATUS.CANCELLED) {
      return { success: false, error: 'Cannot suggest edits to completed debts', code: 'INVALID_STATE' };
    }

    const now = new Date();
    const updatedDebt = await this.debtRepo.update(debtId, {
      suggestedAmount: suggestion.amount ?? null,
      suggestedDescription: suggestion.description ?? null,
      suggestedById: currentUser.id,
      suggestedAt: now,
      updatedAt: now
    });

    // Notification (fire-and-forget)
    if (debt.uploadedById) {
      await this.notify(debt.uploadedById, {
        title: 'Edit Suggested',
        body: `Someone suggested changes to your debt of ${debt.amount.toLocaleString()} VND`,
        url: `/debts/${debtId}`
      });
    }

    return { success: true, debt: updatedDebt ? toDebtDetails(updatedDebt) : undefined, message: 'Edit suggestion sent' };
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
      return { success: false, error: 'Only the creator can respond to edit suggestions', code: 'FORBIDDEN' };
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
          description: (debt.suggestedDescription ?? debt.description) || undefined
        }
      : clearSuggestion;

    const updatedDebt = await this.debtRepo.update(debtId, updates);

    // Notification (fire-and-forget)
    if (debt.suggestedById) {
      await this.notify(debt.suggestedById, {
        title: accept ? 'Edit Accepted' : 'Edit Rejected',
        body: accept ? 'Your suggested edit was accepted' : 'Your suggested edit was rejected',
        url: `/debts/${debtId}`
      });
    }

    return {
      success: true,
      debt: updatedDebt ? toDebtDetails(updatedDebt) : undefined,
      message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
    };
  }

  // ── Delete ────────────────────────────────────────────────────

  /** Soft delete a single debt */
  async deleteDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only delete debts you created', code: 'FORBIDDEN' };
    }

    const deleted = await this.debtRepo.softDelete(debtId, new Date());

    if (deleted) {
      await this.log(currentUser.id, 'delete', debtId);
    }

    return { success: deleted };
  }

  /** Batch soft-delete multiple debts */
  async deleteDebts(
    debtIds: string[],
    currentUser: CurrentUser
  ): Promise<{ success: boolean; deleted: number; errors: string[] }> {
    // Zone A: Validate input
    if (debtIds.length > MAX_BATCH_DELETE_SIZE) {
      return {
        success: false,
        deleted: 0,
        errors: [`Maximum ${MAX_BATCH_DELETE_SIZE} debts can be deleted at once`]
      };
    }

    // Zone B: Execute
    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    const errors: string[] = [];
    const toDelete: string[] = [];

    // Check ownership first (fail-fast for unauthorized)
    if (!isAdmin) {
      for (const id of debtIds) {
        const debt = await this.debtRepo.findById(id);
        if (!debt) {
          errors.push(`Debt ${id} not found`);
        } else if (debt.uploadedById !== currentUser.id) {
          errors.push(`Not authorized to delete debt ${id}`);
        } else {
          toDelete.push(id);
        }
      }
    } else {
      toDelete.push(...debtIds);
    }

    const result = await this.debtRepo.batchSoftDelete(toDelete, new Date());
    errors.push(...result.notFound.map(id => `Debt ${id} not found`));

    if (result.deleted.length > 0) {
      await this.log(currentUser.id, 'delete', undefined, undefined, {
        deletedCount: result.deleted.length,
        ids: result.deleted
      });
    }

    return {
      success: errors.length === 0,
      deleted: result.deleted.length,
      errors
    };
  }

  /** Delete all debts uploaded by a user */
  async deleteAllDebts(userId: string): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.debtRepo.softDeleteByUploader(userId, new Date());
    return { success: true, deleted };
  }
}
