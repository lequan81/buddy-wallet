import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { strictRateLimiter } from '@/lib/plugins/middleware';
import { normalizePhoneNumber, maskPhone } from '@repo/utils';
import { containerPlugin } from '@/lib/plugins';
import { configs } from '@/configs';
import { apiSuccess, apiError, GEN_ERRORS } from '@repo/errors';
import * as crypto from 'crypto';
import { DebtService } from '@/app/Services/DebtService';

@injectable()
export class PublicController {
  constructor(
    @inject(DebtService) private debtService: DebtService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/public', (group) =>
      group
        .use(containerPlugin)
        .use(strictRateLimiter)

        // Check if a phone number has active debts
        .get(
          '/check-debt',
          async ({ query, request, set }) => {
            const { phoneNumber, includeCount } = query;

            const normalizedPhone = normalizePhoneNumber(phoneNumber);
            if (!normalizedPhone) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, 'Invalid phone number format');
            }

            // Mitigate Phone Enumeration: Option A (Captcha/Signed Token)
            if (configs.SECURITY.TURNSTILE_SECRET) {
              const captchaToken = request.headers.get('x-captcha-token');
              if (!captchaToken) {
                set.status = 403;
                return apiError(GEN_ERRORS.FORBIDDEN, 'Captcha token required to prevent enumeration');
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
                  return apiError(GEN_ERRORS.FORBIDDEN, 'Invalid captcha token');
                }
              } catch {
                set.status = 503;
                return apiError(GEN_ERRORS.UNKNOWN, 'Captcha verification service unavailable');
              }
            }

            const count = await this.debtService.countActiveDebtsForPhone(normalizedPhone);
            const shouldIncludeCount = includeCount === 'true';
            const countToken = request.headers.get('x-debt-check-token') || '';
            
            let canShowCount = false;
            if (shouldIncludeCount && configs.SECURITY.DEBT_CHECK_COUNT_TOKEN) {
              if (countToken.length === configs.SECURITY.DEBT_CHECK_COUNT_TOKEN.length) {
                canShowCount = crypto.timingSafeEqual(
                  Buffer.from(countToken),
                  Buffer.from(configs.SECURITY.DEBT_CHECK_COUNT_TOKEN)
                );
              }
            }

            return apiSuccess({
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
        )
    );
  }
}
