/**
 * Debt CRUD Service
 * 
 * Handles core debt CRUD operations:
 * - Create debt
 * - Get/read debts
 * - Update debt details
 * - Soft delete single debt
 * 
 * Extends DebtServiceBase for shared helpers (OOP inheritance).
 * Dependencies: db, pushService, activityService
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
  isNull
} from '@repo/db';
import { hasPermission, PERMISSIONS } from '@repo/permissions';
import { normalizePhoneNumber } from '@utils/phone';
import {
  MAX_PENDING_DEBTS,
  DUPLICATE_CHECK_DAYS,
  DUPLICATE_AMOUNT_TOLERANCE
} from '@repo/config';
import { CreateDebtInputSchema, safeParse } from '@repo/validation';
import { logger } from '@repo/logger';
import type { DbClient } from '@/types';
import type { CreateDebtInput, DebtResult } from '@/types';
import type { CurrentUser } from '@/types';
import type { ExpiryOption, PaginationOptions, PaginatedResult } from '@/types';
import type { PushService } from '@services/push.service';
import type { ActivityService } from '@services/activity.service';
import type { DebtDetails } from '@repo/types';
import { DEBT_STATUS, DEBT_DIRECTION } from '@repo/types';
import { calculateExpiryDate, MS_PER_DAY } from '@services/debt/debt.utils';
import { DebtServiceBase, type DrizzleUpdate } from '@services/debt/debt-base.service';

/**
 * DebtCrudService - Core CRUD operations for debts
 * Extends DebtServiceBase for shared validation and notification helpers
 */
export class DebtCrudService extends DebtServiceBase {
  constructor(
    db: DbClient,
    pushService: PushService | null = null,
    activityService: ActivityService | null = null
  ) {
    super(db, pushService, activityService);
  }

  /** Shared paginated query builder */
  private queryDebts(
    baseWhere: ReturnType<typeof or> | undefined,
    options: PaginationOptions = {}
  ): PaginatedResult<DebtDetails> {
    const { limit = 50, offset = 0, status } = options;

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
    const data = query.orderBy(desc(debts.createdAt), desc(debts.id)).limit(limit).offset(offset).all();

    return { data: data.map(debt => this.toDetails(debt)), total, limit, offset };
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
          ne(debts.status, DEBT_STATUS.CANCELLED),
          isNull(debts.deletedAt)
        )
      )
      .all();

    return duplicates.filter((d: { amount: number }) => d.amount <= amount + amountRange);
  }

  /** Get debts for a user (or all debts if admin) with pagination */
  async getDebtsForUser(
    userId: string,
    hasViewAllPermission: boolean,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<DebtDetails>> {
    const baseWhere = hasViewAllPermission
      ? undefined
      : or(eq(debts.debtorId, userId), eq(debts.creditorId, userId));
    return this.queryDebts(baseWhere, options);
  }

  /** Get debts for a specific user (admin only) with pagination */
  async getDebtsByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<DebtDetails>> {
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
          and(ne(debts.status, DEBT_STATUS.PAID), ne(debts.status, DEBT_STATUS.CANCELLED)),
          isNull(debts.deletedAt)
        )
      )
      .get();

    return result?.count ?? 0;
  }

  /**
   * Get a single debt by ID
   */
  async getDebtById(debtId: string): Promise<DebtDetails | undefined> {
    const debt = await this.db.query.debts.findFirst({
      where: and(eq(debts.id, debtId), isNull(debts.deletedAt))
    });
    return debt ? this.toDetails(debt) : undefined;
  }

  /**
   * Get recent contacts for a user (phone numbers they've interacted with)
   */
  async getRecentContacts(userId: string, limit: number = 10): Promise<string[]> {
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

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { phoneNumber: true }
    });
    const myPhone = user?.phoneNumber;

    const seenPhones = new Set<string>();
    const contacts: string[] = [];

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

  // ── CRUD Operations ──────────────────────────────────────────────

  /**
   * Create a new debt
   */
  async createDebt(
    input: CreateDebtInput,
    currentUser: CurrentUser,
    options?: { expiryOption?: ExpiryOption; confirmDuplicate?: boolean }
  ): Promise<DebtResult> {
    // FAIL-FAST VALIDATION: All validation BEFORE any DB queries
    if (!currentUser.phoneNumber) {
      return {
        success: false,
        error: 'Please update your profile with a phone number to create debts.',
        code: 'PHONE_REQUIRED'
      };
    }

    const parseResult = safeParse(CreateDebtInputSchema, input);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.issues[0].message,
        code: 'VALIDATION_ERROR'
      };
    }
    const { amount, description, phoneNumber, direction } = parseResult.output;

    // Validate amount bounds FIRST (Phase 3: Fail-Fast)
    const amountErr = this.validateAmount(amount);
    if (amountErr) return amountErr;

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

    // Check for potential duplicates
    if (!options?.confirmDuplicate) {
      const debtorPhone = direction === DEBT_DIRECTION.LEND ? normalizedCounterpartyPhone : normalizedUserPhone!;
      const creditorPhone = direction === DEBT_DIRECTION.LEND ? normalizedUserPhone! : normalizedCounterpartyPhone;

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

    const expiresAt = calculateExpiryDate(options?.expiryOption || 'never');

    const now = new Date();
    const entry = {
      id: crypto.randomUUID(),
      amount,
      description,
      status: DEBT_STATUS.PENDING as string,
      uploadedById: currentUser.id,
      confirmedByCreditor: direction === DEBT_DIRECTION.LEND,
      confirmedByDebtor: direction === DEBT_DIRECTION.BORROW,
      needsConfirmation: true,
      creditorConfirmedAt: direction === DEBT_DIRECTION.LEND ? now : null,
      debtorConfirmedAt: direction === DEBT_DIRECTION.BORROW ? now : null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      debtorId: null as string | null,
      creditorId: null as string | null,
      debtorPhone: '',
      creditorPhone: ''
    };

    if (direction === DEBT_DIRECTION.LEND) {
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

    // Use transaction for atomic debt creation + activity logging
    await this.db.transaction(async (tx) => {
      await tx.insert(debts).values(entry);
      
      await this.logActivity(
        currentUser.id,
        'create',
        entry.id,
        { after: { amount: entry.amount, description: entry.description } }
      );
    });

    // Send push notification outside transaction (non-critical)
    if (counterparty && this.pushService) {
      try {
        await this.pushService.sendDebtCreatedNotification({
          userId: counterparty.id,
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

    return { success: true, debt: this.toDetails({
        ...entry,
        hasPendingProof: false,
        proofCount: 0,
        lastProofUploadedAt: null,
        suggestedAmount: null,
        suggestedDescription: null,
        suggestedById: null,
        suggestedAt: null,
        deletedAt: null,
        description: entry.description || ''
      }) };
  }

  /**
   * Update debt details (description, amount)
   */
  async updateDebt(
    debtId: string,
    data: { description?: string; amount?: number },
    currentUser: CurrentUser
  ): Promise<DebtResult> {
    // VALIDATE INPUTS FIRST (Fail-Fast)
    if (data.amount !== undefined) {
      const amountErr = this.validateAmount(data.amount);
      if (amountErr) return amountErr;
    }

    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_VIEW_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only edit debts you created', code: 'FORBIDDEN' };
    }

    if ((debt.status as string) !== DEBT_STATUS.PENDING && (debt.status as string) !== DEBT_STATUS.DISPUTED) {
      return {
        success: false,
        error: `Cannot edit debt with status '${debt.status}'. Only pending or disputed debts can be edited.`,
        code: 'INVALID_STATUS'
      };
    }

    const now = new Date();

    // Use transaction for atomic update + activity logging
    const updatedDebt = await this.db.transaction(async (tx) => {
      await tx
        .update(debts)
        .set({
          ...(data.description !== undefined && { description: data.description }),
          ...(data.amount !== undefined && { amount: data.amount }),
          updatedAt: now
        } as DrizzleUpdate)
        .where(eq(debts.id, debtId));
      const result = await tx.query.debts.findFirst({ where: eq(debts.id, debtId) });
      
      await this.logActivity(
        currentUser.id,
        'update',
        debtId,
        { after: data }
      );
      
      return result;
    });

    return { success: true, debt: updatedDebt ? this.toDetails(updatedDebt) : undefined };
  }

  /**
   * Soft delete a single debt
   */
  async deleteDebt(debtId: string, currentUser: CurrentUser): Promise<DebtResult> {
    const [debt, err] = await this.getDebtOrFail(debtId);
    if (err) return err;

    const isAdmin = hasPermission(currentUser.permissions, PERMISSIONS.DEBT_DELETE_ALL);
    if (!isAdmin && debt.uploadedById !== currentUser.id) {
      return { success: false, error: 'You can only delete debts you created', code: 'FORBIDDEN' };
    }

    const now = new Date();

    // Use transaction for atomic delete + activity logging
    await this.db.transaction(async (tx) => {
      await tx.update(debts).set({ deletedAt: now, updatedAt: now } as DrizzleUpdate).where(eq(debts.id, debtId));
      
      await this.logActivity(
        currentUser.id,
        'delete',
        debtId
      );
    });

    return { success: true };
  }
}
