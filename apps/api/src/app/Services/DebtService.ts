import { injectable, inject } from 'tsyringe';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import {
  MAX_PENDING_DEBTS,
  DUPLICATE_AMOUNT_TOLERANCE,
  DUPLICATE_CHECK_DAYS,
  MAX_BATCH_DELETE_SIZE,
  DEBT_STATUS,
  DEBT_DIRECTION
} from '@repo/config';
import { debtStateMachine } from '@/app/Models/debtStateMachine'; // TODO: Replace with Debt domain model (April 20)
import { logger } from '@repo/logger';
import type {
  DebtStatus,
  Result,
  PaginatedResult,
  DebtDetails,
  CreateDebtInput,
  ExpiryOption,
  PaginationOptions
} from '@repo/types';
import { BE_ERRORS } from '@repo/errors';
import type { Debt as DebtEntity } from '@repo/db';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import { PushService } from './PushService';
import { ActivityService } from './ActivityService';
import { validateAmount, validateCreateDebtInput, validatePhones } from '@lib/validation/debt';
import { toDebtDetails, calculateExpiryDate } from '@lib/helpers/debt';



@injectable()
export class DebtService {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    private readonly pushService: PushService,
    private readonly activityService: ActivityService
  ) {}

  // ── Query Methods ─────────────────────────────────────────────

  async getDebts(
    userId: string,
    options: PaginationOptions & { viewAll?: boolean } = {}
  ): Promise<PaginatedResult<DebtDetails>> {
    const status = options.status as DebtStatus | 'all';
    const result = await this.debtRepo.findMany({
      ...options,
      status,
      involvedUserId: options.viewAll ? undefined : userId
    });

    return {
      items: result.items.map(toDebtDetails),
      pagination: result.pagination
    };
  }

  async getDebtById(debtId: string): Promise<DebtDetails | null> {
    const debt = await this.debtRepo.findById(debtId);
    return debt ? toDebtDetails(debt) : null;
  }

  async getRecentContacts(userId: string, limit: number = 10): Promise<string[]> {
    return this.debtRepo.getRecentContacts(userId, limit);
  }

  async countActiveDebtsForPhone(phone: string): Promise<number> {
    return this.debtRepo.countActiveDebtsForPhone(phone);
  }

  // ── Create ────────────────────────────────────────────────────

  async createDebt(
    input: CreateDebtInput,
    currentUser: { id: string; phoneNumber: string | null },
    options?: { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }
  ): Promise<Result<{ debt: DebtDetails }>> {
    // 1. Validate inputs
    const validatedInput = validateCreateDebtInput(input);
    if ('code' in validatedInput) return validatedInput;

    const { amount, description, direction, counterpartyPhone } = validatedInput.data;

    const phoneResult = validatePhones(counterpartyPhone, currentUser.phoneNumber);
    if ('code' in phoneResult) return phoneResult;

    const amountErr = validateAmount(amount);
    if (amountErr) return amountErr;

    // 2. Check pending limit
    const pendingCount = await this.debtRepo.countUnconfirmedByCreditor(currentUser.id);
    if (pendingCount >= MAX_PENDING_DEBTS) {
      return {
        code: 'DEBT_PENDING_LIMIT',
        error: `${BE_ERRORS.DEBT_PENDING_LIMIT.message} (max ${MAX_PENDING_DEBTS})`
      };
    }

    const { counterparty: normalizedCounterparty, user: normalizedUser } = phoneResult.data;

    // 3. Check duplicates
    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === DEBT_DIRECTION.LEND ? normalizedCounterparty : normalizedUser;
      const creditorPhone = direction === DEBT_DIRECTION.LEND ? normalizedUser : normalizedCounterparty;

      const duplicates = await this.debtRepo.findPotentialDuplicates(
        debtorPhone, creditorPhone, amount, DUPLICATE_AMOUNT_TOLERANCE, DUPLICATE_CHECK_DAYS
      );

      if (duplicates.length > 0) {
        return {
          code: 'DEBT_DUPLICATE_WARNING',
          error: BE_ERRORS.DEBT_DUPLICATE_WARNING.message,
          // Custom field for duplicates if needed by frontend
          // @ts-expect-error - duplicates is a custom field for this error
          duplicates
        };
      }
    }

    // 4. Create in DB
    const now = new Date();
    const entry = await this.debtRepo.create({
      id: crypto.randomUUID(),
      amount,
      description,
      status: DEBT_STATUS.PENDING as any,
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

    // 5. Side effects
    await this.activityService.log({
      userId: currentUser.id,
      action: 'create' as any,
      resource: 'debt',
      resourceId: entry.id,
      changes: { after: { amount, description } }
    });

    const counterpartyId = direction === DEBT_DIRECTION.BORROW ? entry.creditorId : entry.debtorId;
    if (counterpartyId) {
      this.pushService.sendDebtCreatedNotification({
        userId: counterpartyId,
        creatorName: currentUser.phoneNumber || 'Someone',
        amount: entry.amount,
        description: entry.description || 'No description',
        debtId: entry.id,
        isCreditor: direction === DEBT_DIRECTION.BORROW
      }).catch(err => logger.error('Failed to send push', { err }));
    }

    return { data: { debt: toDebtDetails(entry) } };
  }

  // ── Update ────────────────────────────────────────────────────

  async updateDebt(
    debtId: string,
    data: { description?: string; amount?: number },
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: DebtEntity | null
  ): Promise<Result<{ debt: DebtDetails }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND', error: BE_ERRORS.DEBT_NOT_FOUND.message };

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { code: 'DEBT_PERMISSION_DENIED', error: BE_ERRORS.DEBT_PERMISSION_DENIED.message };
    }

    if (debt.status !== DEBT_STATUS.PENDING && debt.status !== DEBT_STATUS.DISPUTED) {
      return {
        code: 'DEBT_INVALID_STATUS',
        error: `Only pending or disputed debts can be edited.`
      };
    }

    const updated = await this.debtRepo.update(debtId, {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: data.amount }),
      updatedAt: new Date()
    });

    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    await this.activityService.log({
      userId: currentUser.id,
      action: 'update' as any,
      resource: 'debt',
      resourceId: debtId,
      changes: { after: data }
    });

    return { data: { debt: toDebtDetails(updated) } };
  }

  // ── Status Transitions ────────────────────────────────────────

  async updateDebtStatus(
    debtId: string,
    newStatus: DebtStatus,
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: DebtEntity | null
  ): Promise<Result<{ debt: DebtDetails; previousStatus: string; newStatus: string }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    const isInvolved = debt.debtorId === currentUser.id || debt.creditorId === currentUser.id;
    if (!isAdmin && !isInvolved) {
      return { code: 'DEBT_PERMISSION_DENIED' };
    }

    const now = new Date();
    // Use state machine for validation
    const transitionResult = await debtStateMachine.transition(
      debt as any,
      newStatus,
      { userId: currentUser.id, permissions: currentUser.permissions as any, timestamp: now }
    );

    if (!transitionResult.success) {
      return {
        code: 'DEBT_INVALID_TRANSITION',
        error: transitionResult.error,
        // @ts-expect-error - validTransitions might exist on error result
        validTransitions: transitionResult.validTransitions
      };
    }

    const updated = await this.debtRepo.update(debtId, { status: newStatus as any, updatedAt: now });
    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    await this.activityService.log({
      userId: currentUser.id,
      action: newStatus as any,
      resource: 'debt',
      resourceId: debtId,
      changes: { before: { status: debt.status }, after: { status: newStatus } }
    });

    return {
      data: {
        debt: toDebtDetails(updated),
        previousStatus: debt.status,
        newStatus
      }
    };
  }

  async confirmDebt(
    debtId: string,
    currentUser: { id: string; phoneNumber: string | null },
    preloadedDebt?: DebtEntity | null
  ): Promise<Result<{ debt: DebtDetails; message: string }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;

    if (!isCreditor && !isDebtor) return { code: 'DEBT_PERMISSION_DENIED' };
    if (debt.uploadedById === currentUser.id) return { code: 'DEBT_ALREADY_CONFIRMED' };

    const now = new Date();
    const updates: any = { updatedAt: now };

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

    const updated = await this.debtRepo.update(debtId, updates);
    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    await this.activityService.log({
      userId: currentUser.id,
      action: 'confirm' as any,
      resource: 'debt',
      resourceId: debtId
    });

    // Notify uploader
    if (debt.uploadedById) {
      this.pushService.sendDebtConfirmedNotification({
        userId: debt.uploadedById,
        confirmerName: currentUser.phoneNumber || 'Counterparty',
        amount: debt.amount,
        description: debt.description || 'No description',
        debtId
      }).catch(err => logger.error('Failed to send push', { err }));
    }

    return {
      data: {
        debt: toDebtDetails(updated),
        message: 'Debt confirmed successfully'
      }
    };
  }

  // ── Suggestions ───────────────────────────────────────────────

  async suggestEdit(
    debtId: string,
    currentUser: { id: string },
    suggestion: { amount?: number; description?: string },
    preloadedDebt?: DebtEntity | null
  ): Promise<Result<{ debt: DebtDetails; message: string }>> {
    if (!suggestion.amount && !suggestion.description) {
      return { code: 'INVALID_INPUT', error: 'Provide at least amount or description' };
    }

    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    if (debt.creditorId !== currentUser.id && debt.debtorId !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };
    if (debt.uploadedById === currentUser.id) return { code: 'FORBIDDEN', error: 'Creators cannot suggest edits' };
    if (debt.status === DEBT_STATUS.PAID || debt.status === DEBT_STATUS.CANCELLED) return { code: 'INVALID_STATE' };

    const updated = await this.debtRepo.update(debtId, {
      suggestedAmount: suggestion.amount ?? null,
      suggestedDescription: suggestion.description ?? null,
      suggestedById: currentUser.id,
      suggestedAt: new Date(),
      updatedAt: new Date()
    });

    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    return { data: { debt: toDebtDetails(updated), message: 'Edit suggestion sent' } };
  }

  async respondToSuggestion(
    debtId: string,
    currentUser: { id: string },
    accept: boolean,
    preloadedDebt?: DebtEntity | null
  ): Promise<Result<{ debt: DebtDetails; message: string }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    if (debt.uploadedById !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };
    if (!debt.suggestedById) return { code: 'INVALID_STATE', error: 'No pending suggestion' };

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

    const updated = await this.debtRepo.update(debtId, updates as any);
    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    return {
      data: {
        debt: toDebtDetails(updated),
        message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
      }
    };
  }

  // ── Delete ────────────────────────────────────────────────────

  async deleteDebt(
    debtId: string,
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: DebtEntity | null
  ): Promise<Result<void>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };

    await this.debtRepo.softDelete(debtId, new Date());
    await this.activityService.log({
      userId: currentUser.id,
      action: 'delete' as any,
      resource: 'debt',
      resourceId: debtId
    });

    return { data: undefined };
  }

  async deleteDebts(
    debtIds: string[],
    currentUser: { id: string; permissions: string[] | null }
  ): Promise<{ deleted: number; errors: string[] }> {
    if (debtIds.length > MAX_BATCH_DELETE_SIZE) {
      return { deleted: 0, errors: [`Maximum ${MAX_BATCH_DELETE_SIZE} debts can be deleted at once`] };
    }

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    const toDelete: string[] = [];
    const errors: string[] = [];

    if (!isAdmin) {
      const foundDebts = await this.debtRepo.findByIds(debtIds);
      const debtsById = new Map(foundDebts.map(d => [d.id, d]));
      for (const id of debtIds) {
        const d = debtsById.get(id);
        if (!d) errors.push(`Debt ${id} not found`);
        else if (d.uploadedById !== currentUser.id) errors.push(`Unauthorized to delete debt ${id}`);
        else toDelete.push(id);
      }
    } else {
      toDelete.push(...debtIds);
    }

    const result = await this.debtRepo.batchSoftDelete(toDelete, new Date());
    errors.push(...result.notFound.map(id => `Debt ${id} not found`));

    return { deleted: result.deleted.length, errors };
  }

  async deleteAllDebts(userId: string): Promise<{ deleted: number }> {
    const deleted = await this.debtRepo.softDeleteByUploader(userId, new Date());
    return { deleted };
  }
}
