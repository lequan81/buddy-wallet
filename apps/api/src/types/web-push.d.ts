declare module 'web-push' {
  export interface Keys {
    p256dh: string;
    auth: string;
  }

  export interface PushSubscription {
    endpoint: string;
    keys: Keys;
  }

  export interface VapidDetails {
    subject: string;
    publicKey: string;
    privateKey: string;
  }

  export interface RequestOptions {
    vapidDetails?: VapidDetails;
    TTL?: number;
    headers?: Record<string, string>;
    contentEncoding?: 'aesgcm' | 'aes128gcm';
    proxy?: string;
    agent?: unknown;
    timeout?: number;
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  export interface WebPushError extends Error {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    endpoint: string;
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<SendResult>;

  export function setGCMAPIKey(apiKey: string): void;

  export function encrypt(
    userPublicKey: string,
    userAuth: string,
    payload: string | Buffer,
    contentEncoding?: 'aesgcm' | 'aes128gcm'
  ): Buffer;

  export function getVapidHeaders(
    audience: string,
    subject: string,
    publicKey: string,
    privateKey: string,
    contentEncoding?: 'aesgcm' | 'aes128gcm',
    expiration?: number
  ): Record<string, string>;
}
