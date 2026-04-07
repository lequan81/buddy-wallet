/**
 * Public Controller
 *
 * Thin controller for public (unauthenticated) endpoints.
 * Delegates to debtService for business logic.
 */
import { Elysia, t } from 'elysia';
import { strictRateLimiter } from '@plugins/middleware';
import { normalizePhoneNumber, maskPhone } from '@utils/phone';
import { servicesPlugin } from '@plugins';
import { configs } from '@/configs';
import { apiResponse, GEN_ERRORS } from '@repo/errors';
import * as crypto from 'crypto';

export const PublicController = new Elysia({ prefix: '/public' })
  .use(servicesPlugin)
  .use(strictRateLimiter)

  // Check if a phone number has active debts
  .get(
    '/check-debt',
    async ({ query, request, set, debtService }) => {
      const { phoneNumber, includeCount } = query;

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        set.status = 400;
        return apiResponse({ ok: false, error: GEN_ERRORS.INVALID_INPUT, details: 'Invalid phone number format' });
      }

      // Mitigate Phone Enumeration: Option A (Captcha/Signed Token)
      if (configs.SECURITY.TURNSTILE_SECRET) {
        const captchaToken = request.headers.get('x-captcha-token');
        if (!captchaToken) {
          set.status = 403;
          return apiResponse({
            ok: false,
            error: GEN_ERRORS.FORBIDDEN,
            details: 'Captcha token required to prevent enumeration'
          });
        }
        
        try {
          const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: configs.SECURITY.TURNSTILE_SECRET,
              response: captchaToken,
              remoteip: request.headers.get('cf-connecting-ip') || undefined
            })
          });
          const outcome = await res.json() as { success: boolean };
          if (!outcome.success) {
            set.status = 403;
            return apiResponse({ ok: false, error: GEN_ERRORS.FORBIDDEN, details: 'Invalid captcha token' });
          }
        } catch {
          set.status = 503;
          return apiResponse({
            ok: false,
            error: GEN_ERRORS.UNKNOWN,
            details: 'Captcha verification service unavailable'
          });
        }
      }

      // Use debtService for the lookup
      const count = await debtService.countActiveDebtsForPhone(normalizedPhone);
      const shouldIncludeCount = includeCount === 'true';
      const countToken = request.headers.get('x-debt-check-token') || '';
      
      let canShowCount = false;
      if (shouldIncludeCount && configs.SECURITY.DEBT_CHECK_COUNT_TOKEN) {
        // Prevent timing attacks with constant-time comparison
        if (countToken.length === configs.SECURITY.DEBT_CHECK_COUNT_TOKEN.length) {
          canShowCount = crypto.timingSafeEqual(
            Buffer.from(countToken),
            Buffer.from(configs.SECURITY.DEBT_CHECK_COUNT_TOKEN)
          );
        }
      }

      return apiResponse({
        ok: true,
        data: {
          phone: maskPhone(normalizedPhone),
          found: count > 0,
          count: canShowCount ? count : null,
          countRedacted: shouldIncludeCount && !canShowCount
        }
      });
    },
    {
      query: t.Object({
        phoneNumber: t.String({ minLength: 9, maxLength: 20 }),
        includeCount: t.Optional(t.Union([t.Literal('true'), t.Literal('false')]))
      })
    }
  );
