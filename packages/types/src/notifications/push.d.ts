import type { BaseResult } from '../api/base';

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

export interface PushResult extends BaseResult {
  messageId?: string;
  delivered?: boolean;
}
