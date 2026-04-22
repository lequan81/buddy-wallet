import { injectable, inject } from 'tsyringe';
import { hasPermission, PERMISSIONS } from '@/lib/security/permissions';
import {
  MAX_PENDING_DEBTS,
  DUPLICATE_AMOUNT_TOLERANCE,
  DUPLICATE_CHECK_DAYS,
  MAX_BATCH_DELETE_SIZE,
  DEBT_STATUS,
  DEBT_DIRECTION
} from '@repo/config';
import { logger } from '@repo/logger';
import type {
  Result,
  Debt,
  DebtDetails,
  CreateDebtInput,
  ExpiryOption
} from '@repo/types';
import { BE_ERRORS } from '@repo/errors';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import type { FileRepositoryInterface } from '@/app/Repositories/Contracts';
import { PushService } from './PushService';
import { ActivityService } from './ActivityService';
import { validateAmount, validateCreateDebtInput, validatePhones } from '@/lib/validation/debt';
import { toDebtDetails, calculateExpiryDate } from '@/lib/helpers/debt';
import { DebtQueryService } from './DebtQueryService';

/**
 * DebtCommandService - Handles all mutating debt operations (CUD)
 *
 * This service encapsulates the core business logic for debt management:
 * - Creating new debts with duplicate detection
 * - Updating existing debts (restricted to pending/disputed status)
 * - Deleting debts (soft delete with permission checks)
 * - Managing payment proof approvals/rejections
 *
 * All operations include:
 * - Input validation
 * - Permission checks (ownership or admin rights)
 * - Business rule enforcement (status transitions, pending limits)
 * - Side effects (activity logging, push notifications)
 *
 * @example
 * ```typescript
 * // Create a new debt
 * const result = await debtCommandService.createDebt(
 *   { amount: 100000, description: 'Lunch', counterpartyPhone: '+1234567890', direction: 'lend' },
 *   { id: 'user-123', phoneNumber: '+0987654321' }
 * );
 *
 * // Delete a debt
 * await debtCommandService.deleteDebt(debtId, { id: 'user-123', permissions: [] });
 * ```
 */
@injectable()
export class DebtCommandService {
  /**
   * Creates an instance of DebtCommandService
   * @param debtRepo - Repository for debt persistence
   * @param pushService - Service for sending push notifications
   * @param activityService - Service for logging user activities
   * @param debtQueryService - Service for debt queries (used for duplicate detection)
   */
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject(PushService) private readonly pushService: PushService,
    @inject(ActivityService) private readonly activityService: ActivityService,
    @inject(DebtQueryService) private readonly debtQueryService: DebtQueryService
  ) {}

  // ── Create ────────────────────────────────────────────────────

  /**
   * Creates a new debt between two parties
   *
   * Business Logic:
   * 1. Validates input (amount, description, phone numbers)
   * 2. Checks pending debt limit (prevents spam)
   * 3. Detects potential duplicates (warns if similar debt exists)
   * 4. Creates debt record with appropriate confirmation state
   * 5. Sends push notification to counterparty
   * 6. Logs activity for audit trail
   *
   * @param input - Debt creation parameters
   * @param input.amount - Debt amount in smallest currency unit
   * @param input.description - Optional debt description
   * @param input.counterpartyPhone - Phone number of other party
   * @param input.direction - 'lend' (user is creditor) or 'borrow' (user is debtor)
   * @param currentUser - The user creating the debt
   * @param currentUser.id - User's unique identifier
   * @param currentUser.phoneNumber - User's phone number (required for debt creation)
   * @param options - Optional configuration
   * @param options.expiryOption - When the debt expires ('1d', '3d', '7d', '30d', '90d', 'never')
   * @param options.confirmDuplicate - If true, bypasses duplicate warning
   * @returns Result containing created debt details, or error code
   * @throws Never throws - returns Result with error code on failure
   */
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
    if (amountErr && 'code' in amountErr) return amountErr as Result<{ debt: DebtDetails }>;

    // 2. Check pending limit
    const pendingCount = await this.debtRepo.countUnconfirmedByCreditor(currentUser.id);
    if (pendingCount >= MAX_PENDING_DEBTS) {
      return {
        code: 'DEBT_PENDING_LIMIT',
        error: `${BE_ERRORS.DEBT_PENDING_LIMIT.message} (max ${MAX_PENDING_DEBTS})`
      };
    }

    const { counterparty: normalizedCounterparty, user: normalizedUser } = phoneResult.data;

    // Guard: user must have a phone number to create debts
    if (!normalizedUser) {
      return {
        code: 'USER_PHONE_REQUIRED',
        error: 'User must have a phone number to create debts'
      };
    }

    // 3. Check duplicates
    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === DEBT_DIRECTION.LEND ? normalizedCounterparty : normalizedUser;
      const creditorPhone = direction === DEBT_DIRECTION.LEND ? normalizedUser : normalizedCounterparty;

      const duplicates = await this.debtQueryService.findPotentialDuplicates(
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
      debtorPhone: direction === DEBT_DIRECTION.BORROW ? normalizedUser! : normalizedCounterparty,
      creditorPhone: direction === DEBT_DIRECTION.LEND ? normalizedUser! : normalizedCounterparty
    });

    // 5. Side effects
    await this.activityService.log({
      userId: currentUser.id,
      action: 'create',
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

  /**
   * Updates an existing debt's description and/or amount
   *
   * Restrictions:
   * - Only pending or disputed debts can be edited
   * - Only the debt creator or admins can edit
   *
   * @param debtId - The debt to update
   * @param data - Fields to update
   * @param data.description - New description (optional)
   * @param data.amount - New amount (optional)
   * @param currentUser - User attempting the update
   * @param currentUser.id - User's unique identifier
   * @param currentUser.permissions - User's permission array
   * @param preloadedDebt - Optional pre-loaded debt entity (optimization)
   * @returns Result containing updated debt details, or error code
   * @throws Never throws - returns Result with error code on failure
   */
  async updateDebt(
    debtId: string,
    data: { description?: string; amount?: number },
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: Debt | null
  ): Promise<Result<{ debt: DebtDetails }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND', error: BE_ERRORS.DEBT_NOT_FOUND.message };

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_VIEW_ALL);
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
      action: 'update',
      resource: 'debt',
      resourceId: debtId,
      changes: { after: data }
    });

    return { data: { debt: toDebtDetails(updated) } };
  }

  // ── Delete ────────────────────────────────────────────────────

  /**
   * Soft deletes a single debt
   *
   * Permission rules:
   * - Debt owner can delete their own debts
   * - Admins with DEBT_DELETE_ALL permission can delete any debt
   *
   * @param debtId - The debt to delete
   * @param currentUser - User attempting deletion
   * @param preloadedDebt - Optional pre-loaded debt entity (optimization)
   * @returns Result indicating success, or error code
   * @throws Never throws - returns Result with error code on failure
   */
  async deleteDebt(
    debtId: string,
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: Debt | null
  ): Promise<Result<void>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) return { code: 'DEBT_PERMISSION_DENIED' };

    await this.debtRepo.softDelete(debtId, new Date());
    await this.activityService.log({
      userId: currentUser.id,
      action: 'delete' as const,
      resource: 'debt',
      resourceId: debtId
    });

    return { data: undefined };
  }

  /**
   * Batch soft deletes multiple debts
   *
   * Validates permissions for each debt individually.
   * Non-admins can only delete debts they created.
   *
   * @param debtIds - Array of debt IDs to delete
   * @param currentUser - User attempting batch deletion
   * @returns Object with count of deleted debts and array of error messages
   * @throws Never throws - returns partial results on individual failures
   */
  async deleteDebts(
    debtIds: string[],
    currentUser: { id: string; permissions: string[] | null }
  ): Promise<{ deleted: number; errors: string[] }> {
    if (debtIds.length > MAX_BATCH_DELETE_SIZE) {
      return { deleted: 0, errors: [`Maximum ${MAX_BATCH_DELETE_SIZE} debts can be deleted at once`] };
    }

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_DELETE_ALL);
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

  /**
   * Deletes all debts created by a specific user (GDPR/data cleanup)
   *
   * @param userId - The user whose debts should be deleted
   * @returns Object with count of deleted debts
   * @throws Never throws - returns { deleted: 0 } on error
   * @internal Used for account deletion flows
   */
  async deleteAllDebts(userId: string): Promise<{ deleted: number }> {
    const deleted = await this.debtRepo.softDeleteByUploader(userId, new Date());
    return { deleted };
  }

  // ── Payment Proof Management ───────────────────────────────────

  /**
   * Approves a payment proof upload for a debt
   *
   * Business Rules:
   * - Only the creditor can approve payment proofs
   * - Updates proof status to 'approved'
   * - If all proofs are now approved, clears hasPendingProof flag on debt
   *
   * @param fileId - The payment proof file ID
   * @param reviewerId - The creditor user ID approving the proof
   * @param fileRepo - Repository for file operations (injected via param for flexibility)
   * @returns Result with approval status and metadata
   * @throws Never throws - returns Result with error code on failure
   */
  async approvePaymentProof(
    fileId: string,
    reviewerId: string,
    fileRepo: FileRepositoryInterface
  ): Promise<Result<{ allProofsApproved: boolean; debtId: string; uploaderId: string }>> {
    const file = await fileRepo.findById(fileId);

    if (!file) return { code: 'FILE_NOT_FOUND', error: 'File not found' };
    if (file.fileType !== 'payment_proof') return { code: 'INVALID_FILE_TYPE', error: 'Not a payment proof' };
    if (file.status !== 'pending') return { code: 'FILE_ALREADY_REVIEWED', error: 'Already reviewed' };
    if (!file.relatedDebtId) return { code: 'FILE_NO_RELATED_DEBT', error: 'No related debt found' };

    const debt = await this.debtRepo.findById(file.relatedDebtId);

    if (!debt) return { code: 'DEBT_NOT_FOUND', error: 'Related debt not found' };

    if (debt.creditorId !== reviewerId) {
      return { code: 'FILE_UNAUTHORIZED', error: 'Only creditor can approve payment proofs' };
    }

    await fileRepo.updateStatus(fileId, 'approved', reviewerId);

    // Recalculate pending proofs for this debt
    const remainingPending = await fileRepo.findByDebtIdAndType(file.relatedDebtId, 'payment_proof', 'pending');

    // Check if all proofs are now approved (no pending left)
    const allProofsApproved = remainingPending.length === 0;

    // Clear hasPendingProof if no more pending proofs
    if (allProofsApproved) {
      await this.debtRepo.update(file.relatedDebtId, {
        hasPendingProof: false,
        updatedAt: new Date()
      });
      logger.debug('Cleared hasPendingProof for debt', { domain: 'DEBT', debtId: file.relatedDebtId });
    }

    logger.debug('Payment proof approved', { domain: 'DEBT', fileId, reviewerId, allProofsApproved });
    return {
      data: {
        allProofsApproved,
        debtId: file.relatedDebtId,
        uploaderId: file.uploadedById
      }
    };
  }

  /**
   * Rejects a payment proof upload for a debt
   *
   * Business Rules:
   * - Only the creditor can reject payment proofs
   * - Updates proof status to 'rejected'
   * - Optional rejection reason is stored
   *
   * @param fileId - The payment proof file ID
   * @param reviewerId - The creditor user ID rejecting the proof
   * @param reason - Optional explanation for rejection
   * @param fileRepo - Repository for file operations
   * @returns Result with rejection metadata
   * @throws Never throws - returns Result with error code on failure
   */
  async rejectPaymentProof(
    fileId: string,
    reviewerId: string,
    reason: string | undefined,
    fileRepo: FileRepositoryInterface
  ): Promise<Result<{ debtId: string; uploaderId: string }>> {
    const file = await fileRepo.findById(fileId);

    if (!file) return { code: 'FILE_NOT_FOUND', error: 'File not found' };
    if (file.fileType !== 'payment_proof') return { code: 'INVALID_FILE_TYPE', error: 'Not a payment proof' };
    if (file.status !== 'pending') return { code: 'FILE_ALREADY_REVIEWED', error: 'Already reviewed' };
    if (!file.relatedDebtId) return { code: 'FILE_NO_RELATED_DEBT', error: 'No related debt found' };

    const debt = await this.debtRepo.findById(file.relatedDebtId);

    if (!debt) return { code: 'DEBT_NOT_FOUND', error: 'Related debt not found' };

    if (debt.creditorId !== reviewerId) {
      return { code: 'FILE_UNAUTHORIZED', error: 'Only creditor can reject payment proofs' };
    }

    await fileRepo.updateStatus(fileId, 'rejected', reviewerId, reason);

    logger.debug('Payment proof rejected', { domain: 'DEBT', fileId, reviewerId, reason });
    return {
      data: {
        debtId: file.relatedDebtId,
        uploaderId: file.uploadedById
      }
    };
  }

  /**
   * Retrieves payment proofs for a specific debt
   *
   * @param debtId - The debt to query
   * @param fileRepo - Repository for file operations
   * @param status - Optional filter by proof status ('pending', 'approved', 'rejected')
   * @returns Result containing array of payment proof metadata
   * @throws Never throws - returns empty array on error
   */
  async getPaymentProofs(
    debtId: string,
    fileRepo: FileRepositoryInterface,
    status?: 'pending' | 'approved' | 'rejected'
  ): Promise<Result<Awaited<ReturnType<FileRepositoryInterface['findByDebtIdAndType']>>>> {
    const proofs = await fileRepo.findByDebtIdAndType(debtId, 'payment_proof', status);
    return { data: proofs };
  }
}
