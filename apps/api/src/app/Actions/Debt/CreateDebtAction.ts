import { injectable, inject } from 'tsyringe';
import { BE_ERRORS } from '@repo/errors';
import { MAX_PENDING_DEBTS, DEBT_STATUS, DEBT_DIRECTION, DUPLICATE_AMOUNT_TOLERANCE, DUPLICATE_CHECK_DAYS } from '@repo/config';
import type { Result, DebtDetails, CreateDebtInput, ExpiryOption } from '@repo/types';
import type { DebtRepositoryInterface } from '@/app/Repositories/Contracts/DebtRepositoryInterface';
import { LogAction } from '@/app/Actions/System/LogAction';
import { SendDebtCreatedNotificationAction } from '@/app/Actions/System/SendDebtCreatedNotificationAction';
import { FindPotentialDuplicatesAction } from '@/app/Actions/Debt/FindPotentialDuplicatesAction';
import { validateAmount, validateCreateDebtInput, validatePhones } from '@/lib/validation/debt';
import { toDebtDetails } from "@/lib/mappers/debt";
import { calculateExpiryDate } from '@/lib/helpers/debt';
import { logger } from '@repo/logger';
import { randomUUIDv7 } from 'bun';

@injectable()
export class CreateDebtAction {
  constructor(
    @inject('DebtRepositoryInterface') private readonly debtRepo: DebtRepositoryInterface,
    @inject(LogAction) private readonly logAction: LogAction,
    @inject(SendDebtCreatedNotificationAction) private readonly sendDebtCreatedNotification: SendDebtCreatedNotificationAction,
    @inject(FindPotentialDuplicatesAction) private readonly findDuplicatesAction: FindPotentialDuplicatesAction
  ) {}

  async execute(
    input: CreateDebtInput,
    currentUser: { id: string; phoneNumber: string | null },
    options?: { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }
  ): Promise<Result<{ debt: DebtDetails }>> {
    const validatedInput = validateCreateDebtInput(input);
    if ('code' in validatedInput) return validatedInput;

    const { amount, description, direction, counterpartyPhone } = validatedInput.data;

    const phoneResult = validatePhones(counterpartyPhone, currentUser.phoneNumber);
    if ('code' in phoneResult) return phoneResult;

    const amountErr = validateAmount(amount);
    if (amountErr && 'code' in amountErr) return amountErr as Result<{ debt: DebtDetails }>;

    const pendingCount = await this.debtRepo.countUnconfirmedByCreditor(currentUser.id);
    if (pendingCount >= MAX_PENDING_DEBTS) {
      return { code: 'DEBT_PENDING_LIMIT', error: `${BE_ERRORS.DEBT_PENDING_LIMIT.message} (max ${MAX_PENDING_DEBTS})` };
    }

    const { counterparty: normalizedCounterparty, user: normalizedUser } = phoneResult.data;
    if (!normalizedUser) return { code: 'USER_PHONE_REQUIRED', error: 'User must have a phone number to create debts' };

    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === DEBT_DIRECTION.LEND ? normalizedCounterparty : normalizedUser;
      const creditorPhone = direction === DEBT_DIRECTION.LEND ? normalizedUser : normalizedCounterparty;
      const duplicates = await this.findDuplicatesAction.execute(debtorPhone, creditorPhone, amount, DUPLICATE_AMOUNT_TOLERANCE, DUPLICATE_CHECK_DAYS);
      if (duplicates.length > 0) {
        return { code: 'DEBT_DUPLICATE_WARNING', error: BE_ERRORS.DEBT_DUPLICATE_WARNING.message, duplicates } as any;
      }
    }

    const now = new Date();
    const entry = await this.debtRepo.create({
      id: randomUUIDv7(),
      amount,
      description,
      status: DEBT_STATUS.PENDING,
      uploadedById: currentUser.id,
      confirmedByCreditor: direction === DEBT_DIRECTION.LEND,
      confirmedByDebtor: direction === DEBT_DIRECTION.BORROW,
      needsConfirmation: true,
      creditorConfirmedAt: direction === DEBT_DIRECTION.LEND ? now : null,
      debtorConfirmedAt: direction === DEBT_DIRECTION.BORROW ? now : null,
      expiresAt: calculateExpiryDate((options?.expiryOption as ExpiryOption) || 'never'),
      createdAt: now,
      updatedAt: now,
      debtorId: direction === DEBT_DIRECTION.BORROW ? currentUser.id : null,
      creditorId: direction === DEBT_DIRECTION.LEND ? currentUser.id : null,
      debtorPhone: direction === DEBT_DIRECTION.BORROW ? normalizedUser! : normalizedCounterparty,
      creditorPhone: direction === DEBT_DIRECTION.LEND ? normalizedUser! : normalizedCounterparty
    });

    await this.logAction.execute({
      userId: currentUser.id, action: 'create', resource: 'debt', resourceId: entry.id, changes: { after: { amount, description } }
    });

    const counterpartyId = direction === DEBT_DIRECTION.BORROW ? entry.creditorId : entry.debtorId;
    if (counterpartyId) {
      this.sendDebtCreatedNotification.execute({
        userId: counterpartyId, creatorName: currentUser.phoneNumber || 'Someone', amount: entry.amount, description: entry.description || 'No description', debtId: entry.id, isCreditor: direction === DEBT_DIRECTION.BORROW
      }).catch(err => logger.error('Failed to send push', { err }));
    }

    return { data: { debt: toDebtDetails(entry as any) } };
  }
}
