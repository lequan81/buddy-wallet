/**
 * Public Controller
 *
 * Thin controller for public (unauthenticated) endpoints.
 * Delegates to debtService for business logic.
 */
import { Elysia, t } from 'elysia';
import { strictRateLimiter } from '@plugins/middleware';
import { normalizePhoneNumber, maskPhone } from '@utils/phone';
import { servicesPlugin } from '@plugins/services.plugin';
import { configs } from '@/configs';
import { errorResponse, GEN_ERRORS, successResponse } from '@repo/errors';

export const PublicController = new Elysia({ prefix: '/public' })
  .use(servicesPlugin)
  .use(strictRateLimiter)

  // Check if a phone number has active debts
  .get(
    '/check-debt',
    async ({ query, request, set, debtService }) => {
      const { phoneNumber, includeCount } = query;

      // Validate and normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, 'Invalid phone number format');
      }

      // Use debtService for the lookup
      const count = await debtService.countActiveDebtsForPhone(normalizedPhone);
      const shouldIncludeCount = includeCount === 'true';
      const countToken = request.headers.get('x-debt-check-token') || '';
      const canShowCount =
        shouldIncludeCount &&
        !!configs.SECURITY.DEBT_CHECK_COUNT_TOKEN &&
        countToken === configs.SECURITY.DEBT_CHECK_COUNT_TOKEN;

      return successResponse({
        phone: maskPhone(normalizedPhone),
        found: count > 0,
        count: canShowCount ? count : null,
        countRedacted: shouldIncludeCount && !canShowCount
      });
    },
    {
      query: t.Object({
        phoneNumber: t.String({ minLength: 9, maxLength: 20 }),
        includeCount: t.Optional(t.Union([t.Literal('true'), t.Literal('false')]))
      })
    }
  );
