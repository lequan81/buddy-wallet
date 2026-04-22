import { injectable, inject } from 'tsyringe';
import { hasPermission, PERMISSIONS } from '@/lib/security/permissions';
import { DEBT_STATUS } from '@repo/config';
import { logger } from '@repo/logger';
import type {
  DebtStatus,
  Result,
  DebtDetails,
  Debt as DebtRecord
} from '@repo/types';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import { Debt } from '@/app/Models/Debt';
import { PushService } from './PushService';
import { ActivityService } from './ActivityService';
import { toDebtDetails } from '@/lib/helpers/debt';

/**
 * DebtStatusService - Handles debt status transitions and confirmation flows
 */
@injectable()
export class DebtStatusService {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject(PushService) private readonly pushService: PushService,
    @inject(ActivityService) private readonly activityService: ActivityService
  ) {}

  async updateDebtStatus(
    debtId: string,
    newStatus: DebtStatus,
    currentUser: { id: string; permissions: string[] | null },
    preloadedDebt?: DebtRecord | null
  ): Promise<Result<{ debt: DebtDetails; previousStatus: string; newStatus: string }>> {
    const debt = preloadedDebt || await this.debtRepo.findById(debtId);
    if (!debt) return { code: 'DEBT_NOT_FOUND' };

    const isAdmin = hasPermission(currentUser.permissions || [], PERMISSIONS.DEBT_VIEW_ALL);
    const isInvolved = debt.debtorId === currentUser.id || debt.creditorId === currentUser.id;
    if (!isAdmin && !isInvolved) {
      return { code: 'DEBT_PERMISSION_DENIED' };
    }

    const now = new Date();

    const debtModel = new Debt(
      debt.id,
      debt.amount,
      debt.currency,
      debt.debtorId,
      debt.creditorId,
      debt.status as any,
      new Date(debt.createdAt),
      new Date(debt.updatedAt),
      debt.description || undefined
    );

    try {
      let updatedDebt: Debt;

      switch (newStatus) {
        case 'confirmed':
          updatedDebt = debtModel.confirm(currentUser.id);
          break;
        case 'disputed':
          updatedDebt = debtModel.dispute(currentUser.id);
          break;
        case 'cancelled':
          updatedDebt = debtModel.cancel(currentUser.id);
          break;
        case 'paid':
          updatedDebt = debtModel.markAsPaid(currentUser.id);
          break;
        default:
          return {
            code: 'DEBT_INVALID_STATUS',
            error: `Invalid status: ${newStatus}`
          };
      }

      const updated = await this.debtRepo.update(debtId, {
        status: updatedDebt.status as DebtStatus,
        updatedAt: now
      });
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
          previousStatus: debt.status as string,
          newStatus
        }
      };
    } catch (error) {
      return {
        code: 'DEBT_INVALID_TRANSITION',
        error: (error as Error).message
      };
    }
  }

  async confirmDebt(
    debtId: string,
    currentUser: { id: string; phoneNumber: string | null },
    preloadedDebt?: DebtRecord | null
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

  async suggestEdit(
    debtId: string,
    currentUser: { id: string },
    suggestion: { amount?: number; description?: string },
    preloadedDebt?: DebtRecord | null
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
    } as any);

    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    return { data: { debt: toDebtDetails(updated), message: 'Edit suggestion sent' } };
  }

  async respondToSuggestion(
    debtId: string,
    currentUser: { id: string },
    accept: boolean,
    preloadedDebt?: DebtRecord | null
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

    const updates: any = accept
      ? {
          ...clearSuggestion,
          amount: debt.suggestedAmount ?? debt.amount,
          description: debt.suggestedDescription ?? debt.description
        }
      : clearSuggestion;

    const updated = await this.debtRepo.update(debtId, updates);
    if (!updated) return { code: 'DEBT_NOT_FOUND' };

    return {
      data: {
        debt: toDebtDetails(updated),
        message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
      }
    };
  }
}
