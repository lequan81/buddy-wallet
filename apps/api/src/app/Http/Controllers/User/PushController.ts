import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { GEN_ERRORS } from '@repo/errors';
import { actor, permissionPlugin } from '@/app/Providers/Plugins';
import { broadcastRateLimiter } from '@/app/Http/Middlewares';
import { PERMISSIONS } from '@/lib/security/permissions';
import { GetVapidPublicKeyAction } from '@/app/Actions/System/GetVapidPublicKeyAction';
import { SubscribeAction } from '@/app/Actions/System/SubscribeAction';
import { UnsubscribeAction } from '@/app/Actions/System/UnsubscribeAction';
import { GetUserSubscriptionsAction } from '@/app/Actions/System/GetUserSubscriptionsAction';
import { SendToUserAction } from '@/app/Actions/System/SendToUserAction';
import { BroadcastAction } from '@/app/Actions/System/BroadcastAction';
import { apiSuccess, apiError, isFailureResult } from '@/lib/http';
import type { AuthenticatedElysiaContext, ElysiaActorContext } from '@/types/elysia';

@injectable()
export class PushController {
  constructor(
    @inject(GetVapidPublicKeyAction) private getVapidPublicKeyAction: GetVapidPublicKeyAction,
    @inject(SubscribeAction) private subscribeAction: SubscribeAction,
    @inject(UnsubscribeAction) private unsubscribeAction: UnsubscribeAction,
    @inject(GetUserSubscriptionsAction) private getUserSubscriptionsAction: GetUserSubscriptionsAction,
    @inject(SendToUserAction) private sendToUserAction: SendToUserAction,
    @inject(BroadcastAction) private broadcastAction: BroadcastAction
  ) { }

  register(app: Elysia): any {
    return app.group('/push', (group: any) =>
      group
        .use(actor)
        .use(permissionPlugin)

        // Get VAPID public key (Public access)
        .get('/vapid-key', async (ctx: any) => {
          const { set } = ctx as ElysiaActorContext;
          const publicKey = this.getVapidPublicKeyAction.execute();
 
          if (!publicKey) {
            set.status = 503;
            return apiError(GEN_ERRORS.UNKNOWN, 'Push notifications not configured');
          }
 
          return apiSuccess({ publicKey });
        }, {
          requireActor: false
        })

        // Require actor for all subsequent routes
        .group('', (pushGroup: any) => 
          pushGroup
            .requireActor(true)
            
            // Subscribe to push notifications
            .post(
              '/subscribe',
              async (ctx: any) => {
                const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
                const result = await this.subscribeAction.execute(actor!.id, {
                  endpoint: body.endpoint,
                  keys: body.keys,
                  expirationTime: body.expirationTime,
                  deviceName: body.deviceName,
                  deviceType: body.deviceType as any
                });

                if (isFailureResult(result)) {
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
              async (ctx: any) => {
                const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
                const result = await this.unsubscribeAction.execute(actor!.id, body.endpoint);

                if (isFailureResult(result)) {
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
            .get('/subscriptions', async (ctx: any) => {
              const { actor } = ctx as AuthenticatedElysiaContext;
              const subscriptions = await this.getUserSubscriptionsAction.execute(actor!.id);
              return apiSuccess({ subscriptions });
            })

            // Send test notification (to self)
            .post('/test', async (ctx: any) => {
              const { actor, set } = ctx as AuthenticatedElysiaContext;
              const result = await this.sendToUserAction.execute(actor!.id, {
                title: 'Test Notification',
                body: 'Push notifications are working!',
                icon: '/icons/pwa-192x192.png',
                url: '/dashboard'
              });

              if (isFailureResult(result)) {
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
              async (ctx: any) => {
                const { body, set } = ctx as AuthenticatedElysiaContext<any>;
                const result = await this.broadcastAction.execute({
                  title: body.title,
                  body: body.body,
                  icon: body.icon,
                  url: body.url,
                  requireInteraction: body.requireInteraction
                });

                if (isFailureResult(result)) {
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
        )
    );
  }
}
