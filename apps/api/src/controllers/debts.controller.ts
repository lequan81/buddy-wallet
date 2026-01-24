import { Elysia, t } from 'elysia';
import { db, debts, users, eq, or } from '@repo/db';
import { accessControlPlugin } from '@plugins/access-control';

export const debtsController = new Elysia({ prefix: '/debts' })
  .use(accessControlPlugin)
  .get('/', async ({ user }) => {
    // Return debts where user is involved
    if (user!.role === 'admin') {
      return await db.select().from(debts).all();
    }

    return await db.query.debts.findMany({
      where: or(eq(debts.debtorId, user!.id), eq(debts.creditorId, user!.id))
    });
  })
  .get(
    '/user/:userId',
    async ({ params: { userId }, user, set }) => {
      // Admin only
      if (user?.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Forbidden' };
      }

      const userDebts = await db.query.debts.findMany({
        where: or(eq(debts.debtorId, userId), eq(debts.creditorId, userId))
      });

      return { success: true, debts: userDebts };
    },
    {
      params: t.Object({
        userId: t.String()
      })
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

      const counterparty = await db.query.users.findFirst({
        where: eq(users.phoneNumber, counterpartyPhone)
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
        entry.creditorPhone = user!.phoneNumber;
        entry.debtorPhone = counterpartyPhone;
        if (counterparty) entry.debtorId = counterparty.id;
      } else {
        entry.debtorId = user!.id;
        entry.debtorPhone = user!.phoneNumber;
        entry.creditorPhone = counterpartyPhone;
        if (counterparty) entry.creditorId = counterparty.id;
      }

      await db.insert(debts).values(entry);

      return { success: true, debt: entry };
    },
    {
      body: t.Object({
        amount: t.Number(),
        description: t.String(),
        counterpartyPhone: t.String(),
        direction: t.Union([t.Literal('LEND'), t.Literal('BORROW')])
      })
    }
  );
