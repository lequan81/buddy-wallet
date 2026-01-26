import { Elysia, t } from 'elysia';
import { db, debts, eq, and, or, ne } from '@repo/db';
import { strictRateLimiter } from '@plugins/rate-limit';
import { normalizePhoneNumber, maskPhone } from '@/utils/phone';

export const publicController = new Elysia({ prefix: '/public' })
  // Apply strict rate limiting: 5 requests per minute per IP
  .use(strictRateLimiter)
  .get(
    '/check-debt',
    async ({ query, set }) => {
      const { phoneNumber } = query;

      // Validate and normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        set.status = 400;
        return {
          success: false,
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE_FORMAT'
        };
      }

      // Count active debts linked to this phone number
      // Active = status NOT 'paid' or 'cancelled'
      const activeDebts = db
        .select()
        .from(debts)
        .where(
          and(
            or(eq(debts.debtorPhone, normalizedPhone), eq(debts.creditorPhone, normalizedPhone)),
            and(ne(debts.status, 'paid'), ne(debts.status, 'cancelled'))
          )
        )
        .all();

      const count = activeDebts.length;

      // Return masked phone for privacy confirmation
      return {
        success: true,
        phone: maskPhone(normalizedPhone),
        found: count > 0,
        count
      };
    },
    {
      query: t.Object({
        phoneNumber: t.String({ minLength: 9, maxLength: 20 })
      })
    }
  );
