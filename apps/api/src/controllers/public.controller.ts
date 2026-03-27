/**
 * Public Controller
 *
 * Thin controller for public (unauthenticated) endpoints.
 * Delegates to debtService for business logic.
 */
import { Elysia, t } from 'elysia';
import { strictRateLimiter } from '../plugins/middleware';
import { normalizePhoneNumber, maskPhone } from '../utils/phone';
import { servicesPlugin } from '../plugins/services.plugin';

export const PublicController = new Elysia({ prefix: '/public' })
  .use(servicesPlugin)
  .use(strictRateLimiter)

  // Check if a phone number has active debts
  .get(
    '/check-debt',
    async ({ query, set, debtService }) => {
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

      // Use debtService for the lookup
      const count = await debtService.countActiveDebtsForPhone(normalizedPhone);

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
