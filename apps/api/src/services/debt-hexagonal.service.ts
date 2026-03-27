/**
 * Debt Service - Refactored with Hexagonal Architecture
 * 
 * Uses repository pattern to decouple business logic from ORM.
 * Depends on IDebtRepository interface, not concrete Drizzle implementation.
 * 
 * This is the Application Service in Hexagonal Architecture - it orchestrates
 * use cases by coordinating between domain logic and infrastructure through ports.
 */
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import { normalizePhoneNumber } from '../utils/phone';
import {
  DEBT_MIN_AMOUNT,
  DEBT_MAX_AMOUNT,
  MAX_PENDING_DEBTS,
  DUPLICATE_CHECK_DAYS,
  DUPLICATE_AMOUNT_TOLERANCE
} from '@repo/config';
import { CreateDebtInputSchema, safeParse } from '@repo/validation';
import { debtStateMachine } from '../states';
import { logger } from '@repo/logger';
import type { DebtStatus, CreateDebtInput, DebtResult, StatusUpdateResult } from '../types';
import type { CurrentUser } from '../types';
import type { ExpiryOption, PaginationOptions, PaginatedResult } from '../types';
import type { PushService } from './push.service';
import type { ActivityService } from './activity.service';
import type { DebtDetails } from '@repo/types';
import { DEBT_STATUS, DEBT_DIRECTION } from '@repo/types';
import type { IDebtRepository, DebtEntity } from '../repositories';

/**
 * Maps a DebtEntity to DebtDetails DTO
 */
function toDebtDetails(entity: DebtEntity): DebtDetails {
  return {
    ...entity,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    creditorConfirmedAt: entity.creditorConfirmedAt?.toISOString() || null,
    debtorConfirmedAt: entity.debtorConfirmedAt?.toISOString() || null,
    lastProofUploadedAt: entity.lastProofUploadedAt?.toISOString() || null,
    expiresAt: entity.expiresAt?.toISOString() || null,
    suggestedAt: entity.suggestedAt?.toISOString() || null,
    deletedAt: entity.deletedAt?.toISOString() || null,
  };
}

/**
 * Calculate expiry date from option
 */
function calculateExpiryDate(option: ExpiryOption): Date | null {
  if (option === 'never') return null;
  const days = { '7d': 7, '30d': 30, '90d': 90 }[option];
  if (!days) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Push notification payload shape */
interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * DebtService with Hexagonal Architecture
 * Depends on IDebtRepository (port) instead of direct DB access
 */
export class DebtServiceHex {
  constructor(
    private debtRepo: IDebtRepository,
    private pushService: PushService | null = null,
    private activityService: ActivityService | null = null
  ) {}

  // ── Private Helpers ──────────────────────────────────────────────

  /** Fetch a debt by ID or return a NOT_FOUND error */
  private async getDebtOrFail(debtId: string): Promise<[DebtEntity, null] | [null, DebtResult]> {
    const debt = await this.debtRepo.findById(debtId);
    if (!debt) return [null, { success: false, error: 'Debt not found', code: 'NOT_FOUND' }];
    return [debt, null];
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

  // ── Query Methods ──────────────────────────────────────────────

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

  async getDebtById(debtId: string): Promise<DebtDetails | undefined> {
    const debt = await this.debtRepo.findById(debtId);
    return debt ? toDebtDetails(debt) : undefined;
  }

  async getRecentContacts(userId: string, limit: number = 10): Promise<string[]> {
    return this.debtRepo.getRecentContacts(userId, limit);
  }

  // ── CRUD Operations ──────────────────────────────────────────────

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

    // Validate input
    const parseResult = safeParse(CreateDebtInputSchema, input);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.issues[0].message,
        code: 'VALIDATION_ERROR'
      };
    }
    const { amount, description, phoneNumber, direction } = parseResult.output;

    const normalizedCounterpartyPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedCounterpartyPhone) {
      return {
        success: false,
        error: 'Invalid counterparty phone number format',
        code: 'INVALID_PHONE_FORMAT'
      };
    }

    const normalizedUserPhone = normalizePhoneNumber(currentUser.phoneNumber);
    if (normalizedCounterpartyPhone === normalizedUserPhone) {
      return {
        success: false,
        error: 'Cannot create a debt with yourself',
        code: 'SELF_DEBT_NOT_ALLOWED'
      };
    }

    // Check unconfirmed debt limit using repository
    const pendingCount = await this.debtRepo.countUnconfirmedByCreditor(currentUser.id);
    if (pendingCount >= MAX_PENDING_DEBTS) {
      return {
        success: false,
        error: `Too many unconfirmed debts (max ${MAX_PENDING_DEBTS}). Wait for debtors to confirm existing debts.`,
        code: 'PENDING_DEBT_LIMIT'
      };
    }

    // Check for duplicates
    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === DEBT_DIRECTION.LEND ? normalizedCounterpartyPhone : normalizedUserPhone!;
      const creditorPhone = direction === DEBT_DIRECTION.LEND ? normalizedUserPhone! : normalizedCounterpartyPhone;

      const duplicates = await this.debtRepo.findPotentialDuplicates(
        debtorPhone,
        creditorPhone,
        amount,
        DUPLICATE_AMOUNT_TOLERANCE,
        DUPLICATE_CHECK_DAYS
      );

      if (duplicates.length > 0) {
        return {
          success: false,
          error: 'Potential duplicate debt found',
          code: 'DUPLICATE_WARNING',
          duplicates
        } as DebtResult;
      }
    }

    // Create debt through repository
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
      debtorPhone: direction === DEBT_DIRECTION.BORROW ? normalizedUserPhone! : normalizedCounterpartyPhone,
      creditorPhone: direction === DEBT_DIRECTION.LEND ? normalizedUserPhone! : normalizedCounterpartyPhone
    });

    // Log activity
    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'create',
        resource: 'debt',
        resourceId: entry.id,
        changes: { after: { amount: entry.amount, description: entry.description } }
      });
    }

    // Send notification (non-critical)
    if (this.pushService && (entry.debtorId || entry.creditorId)) {
      const counterpartyId = direction === DEBT_DIRECTION.BORROW ? entry.creditorId : entry.debtorId;
      if (counterpartyId) {
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
    }

    return { 
      success: true, 
      debt: toDebtDetails(entry)
    };
  }

  /**
   * Confirm debt - delegates to DebtStatusService in practice
   * This simplified version shows the pattern
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
        error: 'You created this debt and have already confirmed it.',
        code: 'ALREADY_CONFIRMED'
      };
    }

    // Update through repository
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

    const updatedDebt = await this.debtRepo.update(debtId, updates);

    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'confirm',
        resource: 'debt',
        resourceId: debtId
      });
    }

    return { 
      success: true, 
      debt: updatedDebt ? toDebtDetails(updatedDebt) : undefined,
      message: 'Debt confirmed successfully'
    };
  }

  /**
   * Soft delete a debt
   */
  async deleteDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only delete debts you created', code: 'FORBIDDEN' };
    }

    const deleted = await this.debtRepo.softDelete(debtId, new Date());

    if (deleted && this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'delete',
        resource: 'debt',
        resourceId: debtId
      });
    }

    return { success: deleted };
  }
}

// Re-export for compatibility
export { DebtServiceHex as DebtService };
