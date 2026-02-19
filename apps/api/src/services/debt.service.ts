/**
 * Debt Service (Class-based with Dependency Injection)
 *
 * Handles debt CRUD operations and status transitions.
 * Uses constructor injection for testability.
 * Implements IDebtService interface for LSP compliance.
 * Uses State Machine pattern for status transitions (OCP compliance).
 */
import { debts, users, eq, or, and, ne, gte, desc, count, isNull, type Debt } from '@repo/db';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import { normalizePhoneNumber } from '../utils/phone';
// import { configs } from '../configs'; // Deprecated local config usage for limits
import { DEBT_MIN_AMOUNT, DEBT_MAX_AMOUNT } from '@repo/config';
import { CreateDebtInputSchema, safeParse } from '@repo/validation';
import { debtStateMachine } from '../states';
import { logger } from '../utils';
import type { DbClient } from '../types';
import type { DebtStatus, CreateDebtInput, DebtResult, StatusUpdateResult } from '../types';
import type { IDebtService, CurrentUser } from '../types';
import type { PushService } from './push.service';
import type { ActivityService } from './activity.service';

// Expiry option type
type ExpiryOption = '7d' | '30d' | '90d' | 'never';

// Pagination options type
interface PaginationOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Calculate expiry date from option
function calculateExpiryDate(option: ExpiryOption): Date | null {
  const now = Date.now();
  switch (option) {
    case '7d':
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now + 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now + 90 * 24 * 60 * 60 * 1000);
    case 'never':
      return null;
    default:
      return null;
  }
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

  /**
   * Find potential duplicate debts
   * Checks for debts with same parties and similar amount in the last 7 days
   */
  async findPotentialDuplicates(
    debtorPhone: string,
    creditorPhone: string,
    amount: number
  ): Promise<{ id: string; amount: number; description: string | null; createdAt: Date }[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const amountRange = amount * 0.1; // 10% tolerance

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
          // amount <= (amount + amountRange) - handled client side
          gte(debts.createdAt, sevenDaysAgo),
          gte(debts.createdAt, sevenDaysAgo),
          ne(debts.status, 'cancelled'),
          isNull(debts.deletedAt)
        )
      )
      .all();

    // Filter for amount within range (can't do <= in simple query)
    return duplicates.filter((d) => d.amount <= amount + amountRange);
  }

  /**
   * Get debts for a user (or all debts if admin) with pagination
   */
  async getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const { limit = 50, offset = 0, status } = options;

    // Build where condition
    let whereCondition = hasViewAllPermission
      ? undefined
      : or(eq(debts.debtorId, userId), eq(debts.creditorId, userId));

    // Add status filter if provided
    if (status && status !== 'all') {
      const statusCondition = eq(debts.status, status);
      whereCondition = whereCondition ? and(whereCondition, statusCondition) : statusCondition;
    }

    // Exclude soft-deleted debts
    whereCondition = whereCondition
      ? and(whereCondition, isNull(debts.deletedAt))
      : isNull(debts.deletedAt);

    // Get total count
    const countResult = whereCondition
      ? this.db.select({ count: count() }).from(debts).where(whereCondition).get()
      : this.db.select({ count: count() }).from(debts).get();

    const total = countResult?.count ?? 0;

    // Get paginated data
    let query = this.db.select().from(debts);
    if (whereCondition) {
      query = query.where(whereCondition) as typeof query;
    }
    const data = query.orderBy(desc(debts.createdAt)).limit(limit).offset(offset).all();

    return { data, total, limit, offset };
  }

  /**
   * Get debts for a specific user (admin only) with pagination
   */
  async getDebtsByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const { limit = 50, offset = 0, status } = options;

    let whereCondition = or(eq(debts.debtorId, userId), eq(debts.creditorId, userId));

    if (status && status !== 'all') {
      whereCondition = and(whereCondition, eq(debts.status, status)) as typeof whereCondition;
    }

    // Exclude soft-deleted debts
    whereCondition = and(whereCondition, isNull(debts.deletedAt)) as typeof whereCondition;

    const countResult = this.db.select({ count: count() }).from(debts).where(whereCondition!).get();
    const total = countResult?.count ?? 0;

    const data = this.db
      .select()
      .from(debts)
      .where(whereCondition!)
      .orderBy(desc(debts.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return { data, total, limit, offset };
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
          and(ne(debts.status, 'paid'), ne(debts.status, 'cancelled')),
          isNull(debts.deletedAt)
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
    const { amount, description, counterpartyPhone, direction } = parseResult.output;

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

    const entry = {
      id: crypto.randomUUID(),
      amount,
      description,
      status: 'confirmed' as const, // Confirmed for creator's view, but needs counterparty confirmation
      uploadedById: currentUser.id,
      // Confirmation tracking - creator auto-confirms, counterparty needs to confirm
      confirmedByCreditor: direction === 'LEND', // Auto-confirmed by creator if they're creditor
      confirmedByDebtor: direction === 'BORROW', // Auto-confirmed by creator if they're debtor
      needsConfirmation: true, // Flag that counterparty still needs to confirm
      creditorConfirmedAt: direction === 'LEND' ? new Date() : null,
      debtorConfirmedAt: direction === 'BORROW' ? new Date() : null,
      expiresAt, // Expiry for unconfirmed debts (null = never expires)
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

    // Activity Log
    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'create',
        resource: 'debt',
        resourceId: entry.id,
        changes: { after: { amount: entry.amount, description: entry.description } }
      });
    }

    // Send push notification to counterparty if they're a registered user
    if (counterparty && this.pushService) {
      try {
        await this.pushService.sendDebtCreatedNotification({
          userId: counterparty.id,
          creatorName: currentUser.phoneNumber || 'Someone',
          amount: entry.amount,
          description: entry.description || 'No description',
          debtId: entry.id,
          isCreditor: direction === 'BORROW' // If creator borrowed, counterparty is creditor
        });
        logger.push(`Debt notification sent to ${counterparty.id}`);
      } catch (error) {
        // Don't fail debt creation if notification fails
        logger.error('Failed to send debt notification', { error: String(error) });
      }
    }

    return { success: true, debt: entry };
  }

  /**
   * Confirm a debt by counterparty
   * Only the counterparty (not the creator) can confirm
   */
  async confirmDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const debt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    if (!debt) {
      return { success: false, error: 'Debt not found', code: 'NOT_FOUND' };
    }

    // Check if user is creditor or debtor
    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;

    if (!isCreditor && !isDebtor) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }

    // Check if user is the creator (creators cannot confirm their own debts)
    const isCreator = debt.uploadedById === currentUser.id;
    if (isCreator) {
      return {
        success: false,
        error:
          'You created this debt and have already confirmed it. Waiting for counterparty confirmation.',
        code: 'ALREADY_CONFIRMED'
      };
    }

    // Check if already confirmed by this party
    if ((isCreditor && debt.confirmedByCreditor) || (isDebtor && debt.confirmedByDebtor)) {
      return { success: true, debt, message: 'You already confirmed this debt' };
    }

    // Update confirmation status
    const updates: Partial<typeof debt> = {
      updatedAt: new Date()
    };

    if (isCreditor) {
      updates.confirmedByCreditor = true;
      updates.creditorConfirmedAt = new Date();
    }
    if (isDebtor) {
      updates.confirmedByDebtor = true;
      updates.debtorConfirmedAt = new Date();
    }

    // If both parties confirmed, mark as fully confirmed
    const willBeFullyConfirmed =
      (updates.confirmedByCreditor || debt.confirmedByCreditor) &&
      (updates.confirmedByDebtor || debt.confirmedByDebtor);

    if (willBeFullyConfirmed) {
      updates.needsConfirmation = false;
    }

    await this.db.update(debts).set(updates).where(eq(debts.id, debtId));

    // Fetch updated debt
    const updatedDebt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    // Send notification to the creator that their debt was confirmed
    if (this.pushService && debt.uploadedById) {
      try {
        await this.pushService.sendDebtConfirmedNotification({
          userId: debt.uploadedById,
          confirmerName: currentUser.phoneNumber || 'Counterparty',
          amount: debt.amount,
          description: debt.description || 'No description',
          debtId
        });
        logger.push(`Debt confirmation notification sent to ${debt.uploadedById}`);
      } catch (error) {
        // Don't fail confirmation if notification fails
        logger.error('Failed to send confirmation notification', { error: String(error) });
      }
    }

    // Activity Log
    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'confirm',
        resource: 'debt',
        resourceId: debtId
      });
    }

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

    // Use State Machine for transition validation and lifecycle hooks
    const transitionResult = await debtStateMachine.transition(debt as Debt, newStatus, {
      userId: currentUser.id,
      permissions: currentUser.permissions,
      timestamp: new Date()
    });

    if (!transitionResult.success) {
      return {
        success: false,
        error: transitionResult.error,
        code: transitionResult.code,
        validTransitions: transitionResult.validTransitions
      };
    }

    // Update debt status
    await this.db
      .update(debts)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(debts.id, debtId));

    // Fetch the updated debt
    const updatedDebt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    // Activity Log
    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: newStatus,
        resource: 'debt',
        resourceId: debtId,
        changes: { before: { status: debt.status }, after: { status: newStatus } }
      });
    }

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
    // Get current debt
    const debt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    if (!debt) {
      return { success: false, error: 'Debt not found', code: 'NOT_FOUND' };
    }

    // Check if user is owner (uploaded the debt) or admin
    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    const isOwner = debt.uploadedById === currentUser.id;

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'You can only edit debts you created', code: 'FORBIDDEN' };
    }

    // Can only edit if status is pending or disputed
    if (!['pending', 'disputed'].includes(debt.status)) {
      return {
        success: false,
        error: `Cannot edit debt with status '${debt.status}'. Only pending or disputed debts can be edited.`,
        code: 'INVALID_STATUS'
      };
    }

    // Validate amount if provided
    if (data.amount !== undefined) {
      if (data.amount < DEBT_MIN_AMOUNT) {
        return {
          success: false,
          error: `Minimum debt amount is ${DEBT_MIN_AMOUNT}`,
          code: 'AMOUNT_TOO_LOW'
        };
      }
      if (data.amount > DEBT_MAX_AMOUNT) {
        return {
          success: false,
          error: `Maximum debt amount is ${DEBT_MAX_AMOUNT}`,
          code: 'AMOUNT_TOO_HIGH'
        };
      }
    }

    // Update debt
    await this.db
      .update(debts)
      .set({
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: data.amount }),
        updatedAt: new Date()
      })
      .where(eq(debts.id, debtId));

    // Fetch updated debt
    const updatedDebt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    // Activity Log
    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'update',
        resource: 'debt',
        resourceId: debtId,
        changes: { after: data }
      });
    }

    return { success: true, debt: updatedDebt };
  }

  /**
   * Soft delete a single debt
   */
  async deleteDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    // Get current debt
    const debt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    if (!debt) {
      return { success: false, error: 'Debt not found', code: 'NOT_FOUND' };
    }

    // Check if user is owner or admin
    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    const isOwner = debt.uploadedById === currentUser.id;

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'You can only delete debts you created', code: 'FORBIDDEN' };
    }

    // Soft delete by setting deletedAt
    await this.db
      .update(debts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(debts.id, debtId));

    // Activity Log
    if (this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'delete',
        resource: 'debt',
        resourceId: debtId
      });
    }

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

    // Limit batch size
    if (debtIds.length > 50) {
      return { success: false, deleted: 0, errors: ['Maximum 50 debts can be deleted at once'] };
    }

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);

    for (const debtId of debtIds) {
      const debt = await this.db.query.debts.findFirst({
        where: eq(debts.id, debtId)
      });

      if (!debt) {
        errors.push(`Debt ${debtId} not found`);
        continue;
      }

      const isOwner = debt.uploadedById === currentUser.id;
      if (!isAdmin && !isOwner) {
        errors.push(`Not authorized to delete debt ${debtId}`);
        continue;
      }

      await this.db
        .update(debts)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(debts.id, debtId));

      deletedCount++;
    }

    // Activity Log (Batch)
    if (deletedCount > 0 && this.activityService) {
      await this.activityService.log({
        userId: currentUser.id,
        action: 'delete',
        resource: 'debt',
        metadata: { deletedCount, ids: debtIds }
      });
    }

    return {
      success: errors.length === 0,
      deleted: deletedCount,
      errors
    };
  }

  /**
   * Suggest an edit to a debt (counterparty can suggest changes to amount/description)
   */
  async suggestEdit(
    debtId: string,
    currentUser: CurrentUser,
    suggestion: { amount?: number; description?: string }
  ): Promise<DebtResult> {
    const debt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    if (!debt) {
      return { success: false, error: 'Debt not found', code: 'NOT_FOUND' };
    }

    // Only counterparty (not creator) can suggest edits
    const isCreditor = debt.creditorId === currentUser.id;
    const isDebtor = debt.debtorId === currentUser.id;
    const isCreator = debt.uploadedById === currentUser.id;

    if (!isCreditor && !isDebtor) {
      return { success: false, error: 'You are not involved in this debt', code: 'FORBIDDEN' };
    }

    if (isCreator) {
      return {
        success: false,
        error: 'Creators cannot suggest edits to their own debts',
        code: 'FORBIDDEN'
      };
    }

    // Cannot suggest if already confirmed or paid
    if (debt.status === 'paid' || debt.status === 'cancelled') {
      return {
        success: false,
        error: 'Cannot suggest edits to completed debts',
        code: 'INVALID_STATE'
      };
    }

    // Must provide at least one change
    if (!suggestion.amount && !suggestion.description) {
      return {
        success: false,
        error: 'Must provide at least amount or description to suggest',
        code: 'VALIDATION_ERROR'
      };
    }

    // Validate amount if provided
    if (suggestion.amount !== undefined) {
      if (suggestion.amount < DEBT_MIN_AMOUNT || suggestion.amount > DEBT_MAX_AMOUNT) {
        return {
          success: false,
          error: `Amount must be between ${DEBT_MIN_AMOUNT} and ${DEBT_MAX_AMOUNT}`,
          code: 'VALIDATION_ERROR'
        };
      }
    }

    // Update debt with suggestion
    await this.db
      .update(debts)
      .set({
        suggestedAmount: suggestion.amount ?? null,
        suggestedDescription: suggestion.description ?? null,
        suggestedById: currentUser.id,
        suggestedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(debts.id, debtId));

    // Notify the creator
    if (debt.uploadedById && this.pushService) {
      try {
        await this.pushService.sendToUser(debt.uploadedById, {
          title: 'Edit Suggested',
          body: `Someone suggested changes to your debt of ${debt.amount.toLocaleString()} VND`,
          url: `/debts/${debtId}`
        });
      } catch (e) {
        // Ignore notification failures
      }
    }

    const updatedDebt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    return { success: true, debt: updatedDebt, message: 'Edit suggestion sent' };
  }

  /**
   * Accept or reject a suggested edit
   */
  async respondToSuggestion(
    debtId: string,
    currentUser: CurrentUser,
    accept: boolean
  ): Promise<DebtResult> {
    const debt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    if (!debt) {
      return { success: false, error: 'Debt not found', code: 'NOT_FOUND' };
    }

    // Only the creator can respond to suggestions
    if (debt.uploadedById !== currentUser.id) {
      return {
        success: false,
        error: 'Only the creator can respond to edit suggestions',
        code: 'FORBIDDEN'
      };
    }

    // Check if there's a pending suggestion
    if (!debt.suggestedById) {
      return { success: false, error: 'No pending suggestion', code: 'INVALID_STATE' };
    }

    if (accept) {
      // Apply the suggested changes
      await this.db
        .update(debts)
        .set({
          amount: debt.suggestedAmount ?? debt.amount,
          description: debt.suggestedDescription ?? debt.description,
          // Clear suggestion fields
          suggestedAmount: null,
          suggestedDescription: null,
          suggestedById: null,
          suggestedAt: null,
          updatedAt: new Date()
        })
        .where(eq(debts.id, debtId));
    } else {
      // Just clear the suggestion
      await this.db
        .update(debts)
        .set({
          suggestedAmount: null,
          suggestedDescription: null,
          suggestedById: null,
          suggestedAt: null,
          updatedAt: new Date()
        })
        .where(eq(debts.id, debtId));
    }

    // Notify the suggester
    if (debt.suggestedById && this.pushService) {
      try {
        await this.pushService.sendToUser(debt.suggestedById, {
          title: accept ? 'Edit Accepted' : 'Edit Rejected',
          body: accept ? 'Your suggested edit was accepted' : 'Your suggested edit was rejected',
          url: `/debts/${debtId}`
        });
      } catch (e) {
        // Ignore notification failures
      }
    }

    const updatedDebt = await this.db.query.debts.findFirst({
      where: eq(debts.id, debtId)
    });

    return {
      success: true,
      debt: updatedDebt,
      message: accept ? 'Suggestion accepted' : 'Suggestion rejected'
    };
  }

  /**
   * Delete all debts for a user
   */
  async deleteAllDebts(userId: string): Promise<{ success: boolean; deleted: number }> {
    // Get all debts uploaded by this user
    const userDebts = await this.db.query.debts.findMany({
      where: eq(debts.uploadedById, userId)
    });

    if (userDebts.length === 0) {
      return { success: true, deleted: 0 };
    }

    // Soft delete all
    await this.db
      .update(debts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(debts.uploadedById, userId));

    return { success: true, deleted: userDebts.length };
  }
}
