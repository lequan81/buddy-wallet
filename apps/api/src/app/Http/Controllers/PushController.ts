import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, apiSuccess, apiError } from '@repo/errors';
import { permissionPlugin, containerPlugin, sessionAuthPlugin } from '@/lib/plugins';
import { PERMISSIONS } from '@/lib/security/permissions';
import { broadcastRateLimiter } from '@/app/Http/Middlewares';
import { PushService } from '@/app/Services/PushService';

@injectable()
export class PushController {
  constructor(
    @inject(PushService) private pushService: PushService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/push', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(permissionPlugin)

        // Get VAPID public key (for client to create subscription)
        .get('/vapid-key', async ({ set }) => {
          const publicKey = this.pushService.getVapidPublicKey();

          if (!publicKey) {
            set.status = 503;
            return apiError(GEN_ERRORS.UNKNOWN, 'Push notifications not configured');
          }

          return apiSuccess({ publicKey });
        })

        // Subscribe to push notifications
        .post(
          '/subscribe',
          async ({ user, body, set }) => {
            if (!user) {
              set.status = 401;
              return apiError(GEN_ERRORS.UNAUTHORIZED);
            }

            const result = await this.pushService.subscribe(user.id, {
              endpoint: body.endpoint,
              keys: body.keys,
              expirationTime: body.expirationTime,
              deviceName: body.deviceName,
              deviceType: body.deviceType as any
            });

            if ('code' in result) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
            }

            return apiSuccess({ subscriptionId: result.data.subscriptionId });
          },
          {
            body: t.Object({
              endpoint: t.String(),
              keys: t.Object({
                p256dh: t.String(),
                auth: t.String()
              }),
              expirationTime: t.Optional(t.Nullable(t.Number())),
              deviceName: t.Optional(t.String()),
              deviceType: t.Optional(
                t.Union([t.Literal('desktop'), t.Literal('mobile'), t.Literal('tablet')])
              )
            })
          }
        )

        // Unsubscribe from push notifications
        .post(
          '/unsubscribe',
          async ({ user, body, set }) => {
            if (!user) {
              set.status = 401;
              return apiError(GEN_ERRORS.UNAUTHORIZED);
            }

            const result = await this.pushService.unsubscribe(user.id, body.endpoint);

            if ('code' in result) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
            }

            return apiSuccess({ message: 'Unsubscribed successfully' });
          },
          {
            body: t.Object({
              endpoint: t.String()
            })
          }
        )

        // Get user's subscriptions
        .get('/subscriptions', async ({ user, set }) => {
          if (!user) {
            set.status = 401;
            return apiError(GEN_ERRORS.UNAUTHORIZED);
          }

          const subscriptions = await this.pushService.getUserSubscriptions(user.id);
          return apiSuccess({ subscriptions });
        })

        // Send test notification (to self)
        .post('/test', async ({ user, set }) => {
          if (!user) {
            set.status = 401;
            return apiError(GEN_ERRORS.UNAUTHORIZED);
          }

          const result = await this.pushService.sendToUser(user.id, {
            title: 'Test Notification',
            body: 'Push notifications are working!',
            icon: '/icons/pwa-192x192.png',
            url: '/dashboard'
          });

          if ('code' in result) {
            set.status = 400;
            return apiError(GEN_ERRORS.INVALID_INPUT, result.error || 'No active subscriptions found');
          }

          return apiSuccess({
            sent: result.data.sent,
            failed: result.data.failed,
            message: `Notification sent to ${result.data.sent} device(s)`
          });
        })

        // Admin: Broadcast notification to all users
        .use(broadcastRateLimiter)
        .post(
          '/broadcast',
          async ({ body, set }) => {
            const result = await this.pushService.broadcast({
              title: body.title,
              body: body.body,
              icon: body.icon,
              url: body.url,
              requireInteraction: body.requireInteraction
            });

            if ('code' in result) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
            }

            return apiSuccess({
              sent: result.data.sent,
              failed: result.data.failed,
              message: `Broadcast sent to ${result.data.sent} device(s)`
            });
          },
          {
            body: t.Object({
              title: t.String(),
              body: t.String(),
              icon: t.Optional(t.String()),
              url: t.Optional(t.String()),
              requireInteraction: t.Optional(t.Boolean())
            }),
            checkPermission: PERMISSIONS.ADMIN_BROADCAST
          }
        )
    );
  }
}

function isFailureResult(result: any): result is { code: string; error: string } {
  return result && typeof result === 'object' && 'code' in result;
}
