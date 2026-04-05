/**
 * Push Notification Type Definitions
 */

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

export type SubscribeInput = PushSubscription;
