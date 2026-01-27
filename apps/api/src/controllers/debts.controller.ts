import { Elysia, t } from 'elysia';
import { db, debts, users, eq, or } from '@repo/db';
import { accessControlPlugin } from '@plugins/access-control';
import { permissionPlugin } from '@plugins/permission';
import { PERMISSIONS, hasPermission } from '@repo/permissions';
import { normalizePhoneNumber } from '@/utils/phone';
import { configs } from '../configs';

// Valid debt status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'disputed', 'cancelled'],
  confirmed: ['paid', 'disputed'],
  disputed: ['pending', 'confirmed', 'cancelled'],
  paid: [], // Terminal state
  cancelled: [] // Terminal state
};

// Debt amount limits
// const MIN_DEBT_AMOUNT = 1000; // Minimum 1,000 (VND or smallest unit)
// const MAX_DEBT_AMOUNT = 1_000_000_000_000; // Maximum 1 trillion

export const debtsController = new Elysia({ prefix: '/debts' })
  .use(permissionPlugin)
  .use(accessControlPlugin)
  .get(
    '/',
    async ({ user, permissions }) => {
      // Check if user has permission to view all debts (admin)
      if (hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL)) {
        return await db.select().from(debts).all();
      }

      // Regular users can only see their own debts
      return await db.query.debts.findMany({
        where: or(eq(debts.debtorId, user!.id), eq(debts.creditorId, user!.id))
      });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN
    }
  )
  .get(
    '/user/:userId',
    async ({ params: { userId }, set }) => {
      // This endpoint is admin-only via permission check
      const userDebts = await db.query.debts.findMany({
        where: or(eq(debts.debtorId, userId), eq(debts.creditorId, userId))
      });

      return { success: true, debts: userDebts };
    },
    {
      params: t.Object({
        userId: t.String()
      }),
      checkPermission: PERMISSIONS.DEBT_VIEW_ALL
    }
  )
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user!.phoneNumber) {
        set.status = 400;
        return {
          success: false,
          message: 'Please update your profile with a phone number to create debts.'
        };
      }

      const { amount, description, counterpartyPhone, direction } = body;

      // Normalize counterparty phone
      const normalizedCounterpartyPhone = normalizePhoneNumber(counterpartyPhone);
      if (!normalizedCounterpartyPhone) {
        set.status = 400;
        return {
          success: false,
          message: 'Invalid counterparty phone number format',
          code: 'INVALID_PHONE_FORMAT'
        };
      }

      // Prevent self-debt
      const normalizedUserPhone = normalizePhoneNumber(user!.phoneNumber);
      if (normalizedCounterpartyPhone === normalizedUserPhone) {
        set.status = 400;
        return {
          success: false,
          message: 'Cannot create a debt with yourself',
          code: 'SELF_DEBT_NOT_ALLOWED'
        };
      }

      // Validate amount
      if (amount < configs.DEBT.MIN_AMOUNT) {
        set.status = 400;
        return {
          success: false,
          message: `Minimum debt amount is ${configs.DEBT.MIN_AMOUNT}`,
          code: 'AMOUNT_TOO_LOW'
        };
      }
      if (amount > configs.DEBT.MAX_AMOUNT) {
        set.status = 400;
        return {
          success: false,
          message: `Maximum debt amount is ${configs.DEBT.MAX_AMOUNT}`,
          code: 'AMOUNT_TOO_HIGH'
        };
      }

      const counterparty = await db.query.users.findFirst({
        where: eq(users.phoneNumber, normalizedCounterpartyPhone)
      });

      const entry = {
        id: crypto.randomUUID(),
        amount,
        description,
        status: 'pending',
        uploadedById: user!.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        debtorId: null as string | null,
        creditorId: null as string | null,
        debtorPhone: '',
        creditorPhone: ''
      };

      if (direction === 'LEND') {
        entry.creditorId = user!.id;
        entry.creditorPhone = normalizedUserPhone!;
        entry.debtorPhone = normalizedCounterpartyPhone;
        if (counterparty) entry.debtorId = counterparty.id;
      } else {
        entry.debtorId = user!.id;
        entry.debtorPhone = normalizedUserPhone!;
        entry.creditorPhone = normalizedCounterpartyPhone;
        if (counterparty) entry.creditorId = counterparty.id;
      }

      await db.insert(debts).values(entry);

      return { success: true, debt: entry };
    },
    {
      body: t.Object({
        amount: t.Number({ minimum: 1 }),
        description: t.String({ maxLength: 500 }),
        counterpartyPhone: t.String({ minLength: 9, maxLength: 20 }),
        direction: t.Union([t.Literal('LEND'), t.Literal('BORROW')])
      }),
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )
  .patch(
    '/:id/status',
    async ({ user, params: { id }, body, set }) => {
      const { status: newStatus } = body;

      // Get current debt
      const debt = await db.query.debts.findFirst({
        where: eq(debts.id, id)
      });

      if (!debt) {
        set.status = 404;
        return { success: false, message: 'Debt not found' };
      }

      // Check if user is involved (unless admin)
      const isAdmin = hasPermission(user!.permissions as string[], PERMISSIONS.DEBT_VIEW_ALL);
      const isInvolved = debt.debtorId === user!.id || debt.creditorId === user!.id;

      if (!isAdmin && !isInvolved) {
        set.status = 403;
        return { success: false, message: 'You are not a party to this debt' };
      }

      // Validate status transition
      const validTransitions = VALID_STATUS_TRANSITIONS[debt.status] || [];
      if (!validTransitions.includes(newStatus)) {
        set.status = 400;
        return {
          success: false,
          message: `Cannot transition from '${debt.status}' to '${newStatus}'`,
          code: 'INVALID_STATUS_TRANSITION',
          validTransitions
        };
      }

      // Update debt status
      await db
        .update(debts)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(debts.id, id));

      return { success: true, previousStatus: debt.status, newStatus };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        status: t.Union([
          t.Literal('pending'),
          t.Literal('confirmed'),
          t.Literal('paid'),
          t.Literal('disputed'),
          t.Literal('cancelled')
        ])
      }),
      ensureRelatedDebt: 'id'
    }
  );
