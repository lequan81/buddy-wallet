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
