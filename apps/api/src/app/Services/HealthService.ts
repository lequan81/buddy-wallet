import { injectable } from 'tsyringe';
import { configs } from '@/config';
import { toOptional } from '@repo/utils';

export type StorageReadiness = {
  ready: boolean;
  missing: string[];
  reason?: string;
};

@injectable()
export class HealthService {
  /**
   * Check if storage configuration is valid.
   */
  public getStorageConfigReadiness(): StorageReadiness {
    const missing: string[] = [];
    if (!configs.STORAGE.S3_ENDPOINT) missing.push('S3_ENDPOINT');
    if (!configs.STORAGE.S3_REGION) missing.push('S3_REGION');
    if (!configs.STORAGE.S3_BUCKET) missing.push('S3_BUCKET');
    if (!configs.STORAGE.S3_ACCESS_KEY_ID) missing.push('S3_ACCESS_KEY_ID');
    if (!configs.STORAGE.S3_SECRET_ACCESS_KEY) missing.push('S3_SECRET_ACCESS_KEY');

    return {
      ready: missing.length === 0,
      missing
    };
  }

  /**
   * Perform a live check on storage connectivity.
   */
  public async getStorageLiveReadiness(): Promise<StorageReadiness> {
    const config = this.getStorageConfigReadiness();
    if (!config.ready) {
      return config;
    }

    try {
      const s3Client = new Bun.S3Client({
        endpoint: toOptional(configs.STORAGE.S3_ENDPOINT),
        region: toOptional(configs.STORAGE.S3_REGION),
        bucket: toOptional(configs.STORAGE.S3_BUCKET),
        accessKeyId: toOptional(configs.STORAGE.S3_ACCESS_KEY_ID),
        secretAccessKey: toOptional(configs.STORAGE.S3_SECRET_ACCESS_KEY),
        virtualHostedStyle: !configs.STORAGE.S3_FORCE_PATH_STYLE
      });

      const probe = s3Client.file('__health/readiness-probe');
      await Promise.race([
        probe.exists(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('S3 readiness timeout')), 3000))
      ]);
      
      return config;
    } catch (error) {
      return {
        ready: false,
        missing: [],
        reason: !configs.APP.IS_PRODUCTION
          ? `S3 connectivity check failed: ${String(error)}`
          : 'S3 connectivity check failed'
      };
    }
  }

  /**
   * Get basic system health metrics.
   */
  public getSystemHealth() {
    return {
      status: 'ok',
      version: '1.2.4',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

