import { Elysia, t } from 'elysia';
import { db, debts, eq, and, or, ne } from '@repo/db';

export const publicController = new Elysia({ prefix: '/public' }).get(
  '/check-debt',
  async ({ query }) => {
    const { phoneNumber } = query;

    if (!phoneNumber) {
      return { found: false, count: 0 };
    }

    // Count active debts linked to this phone number
    // Active = status NOT 'paid' or 'cancelled'
    const activeDebts = db
      .select()
      .from(debts)
      .where(
        and(
          or(eq(debts.debtorPhone, phoneNumber), eq(debts.creditorPhone, phoneNumber)),
          and(ne(debts.status, 'paid'), ne(debts.status, 'cancelled'))
        )
      )
      .all();

    const count = activeDebts.length;

    return {
      found: count > 0,
      count
    };
  },
  {
    query: t.Object({
      phoneNumber: t.String()
    })
  }
);
