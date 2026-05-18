import type { Result } from '../api/base';

/**
 * Push Notification Types
 */
export interface VapidKeys {
  publicKey: string;
  privateKey?: string;
}

export interface SendPushInput {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  url?: string;
  tag?: string;
  priority?: 'normal' | 'high';
}

export interface PushResultData {
  messageId?: string;
  delivered: boolean;
  sent: number;
  failed: number;
}

/**
 * Result type for push notifications
 */
export type PushResult = Result<PushResultData>;
