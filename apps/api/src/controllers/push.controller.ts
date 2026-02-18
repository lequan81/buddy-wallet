/**
 * Push Notification Controller
 *
 * Handles Web Push subscription management and notification sending.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { permissionPlugin } from '../plugins/guards';
import { PERMISSIONS } from '@repo/permissions';
import { PushService } from '../services';
import { broadcastRateLimiter } from '../plugins/middleware';

export const PushController = new Elysia({ prefix: '/push' })
  .use(permissionPlugin)

  // Get VAPID public key (for client to create subscription)
  .get('/vapid-key', async ({ set }) => {
    const publicKey = PushService.getVapidPublicKey();

    if (!publicKey) {
      set.status = 503;
      return errorResponse(GEN_ERRORS.UNKNOWN, 'Push notifications not configured');
    }

    return successResponse({ publicKey });
  })

  // Subscribe to push notifications
  .post(
    '/subscribe',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await PushService.subscribe(user.id, {
        endpoint: body.endpoint,
        keys: body.keys,
        expirationTime: body.expirationTime,
        deviceName: body.deviceName,
        deviceType: body.deviceType
      });

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ subscriptionId: result.subscriptionId });
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
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await PushService.unsubscribe(user.id, body.endpoint);

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ message: 'Unsubscribed successfully' });
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
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const subscriptions = await PushService.getUserSubscriptions(user.id);
    return successResponse({ subscriptions });
  })

  // Send test notification (to self)
  .post('/test', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    const result = await PushService.sendToUser(user.id, {
      title: 'Test Notification',
      body: 'Push notifications are working!',
      icon: '/icons/pwa-192x192.png',
      url: '/dashboard'
    });

    if (!result.success && result.sent === 0) {
      set.status = 400;
      return errorResponse(GEN_ERRORS.INVALID_INPUT, 'No active subscriptions found');
    }

    return successResponse({
      sent: result.sent,
      failed: result.failed,
      message: `Notification sent to ${result.sent} device(s)`
    });
  })

  // Admin: Broadcast notification to all users
  .use(broadcastRateLimiter) // Rate limit: 1 broadcast per minute
  .post(
    '/broadcast',
    async ({ body, set }) => {
      const result = await PushService.broadcast({
        title: body.title,
        body: body.body,
        icon: body.icon,
        url: body.url,
        requireInteraction: body.requireInteraction
      });

      return successResponse({
        sent: result.sent,
        failed: result.failed,
        message: `Broadcast sent to ${result.sent} device(s)`
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
  );
