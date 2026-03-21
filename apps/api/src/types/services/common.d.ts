/**
 * Common Service Types
 */
import type { db } from '@repo/db';

/**
 * Type alias for the Drizzle database client
 */
export type DbClient = typeof db;

/**
 * JWT interface for token signing
 */
export interface JwtService {
  sign: (payload: Record<string, string | number | boolean | undefined>) => Promise<string>;
}

/**
 * Redis cache interface
 */
export interface CacheService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}

import type { StatusUpdateResult } from '@repo/types';

/**
 * Web-push module declaration
 */
declare module 'web-push' {
  interface VapidDetails {
    subject: string;
    publicKey: string;
    privateKey: string;
  }

  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface RequestOptions {
    gcmAPIKey?: string;
    vapidDetails?: VapidDetails;
    TTL?: number;
    headers?: Record<string, string>;
    contentEncoding?: 'aes128gcm' | 'aesgcm';
    proxy?: string;
    agent?: unknown;
  }

  interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  const webpush: {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    setGCMAPIKey: (apiKey: string) => void;
    sendNotification: (
      pushSubscription: PushSubscription,
      payload?: string | null,
      options?: RequestOptions
    ) => Promise<SendResult>;
    generateVAPIDKeys: () => { publicKey: string; privateKey: string };
    encrypt: (
      userPublicKey: string,
      userAuth: string,
      payload: string,
      contentEncoding?: 'aes128gcm' | 'aesgcm'
    ) => { localPublicKey: string; salt: string; cipherText: Buffer };
  };

  export = webpush;
}
