import { injectable } from 'tsyringe';
import { logger } from '@repo/logger';
import type { StorageServiceInterface } from '../Repositories/Contracts/StorageServiceInterface';

const normalizeStoragePath = (rawPath: string): string =>
  rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

@injectable()
export class S3StorageService implements StorageServiceInterface {
  constructor(
    private readonly s3Client: Bun.S3Client,
    private readonly namespace: string,
    private readonly bucket: string,
    private readonly publicBaseUrl?: string
  ) {}

  private toKey(relativePath: string): string {
    const normalizedPath = normalizeStoragePath(relativePath);
    if (!normalizedPath) {
      throw new Error('Invalid path: Empty storage key');
    }

    if (normalizedPath.startsWith(`${this.namespace}/`)) {
      return normalizedPath;
    }

    return `${this.namespace}/${normalizedPath}`;
  }

  async save(relativePath: string, buffer: Buffer | Blob): Promise<string> {
    const key = this.toKey(relativePath);
    await this.s3Client.write(key, buffer);
    return key;
  }

  async read(relativePath: string): Promise<Buffer> {
    const key = this.toKey(relativePath);
    const file = this.s3Client.file(key);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${key}`);
    }

    return Buffer.from(await file.arrayBuffer());
  }

  async delete(relativePath: string): Promise<void> {
    const key = this.toKey(relativePath);
    try {
      await this.s3Client.delete(key);
    } catch (error) {
      logger.warn(`Failed to delete file s3://${this.bucket}/${key}`, {
        key,
        error: String(error)
      });
    }
  }

  resolvePath(relativePath: string): string {
    const key = this.toKey(relativePath);
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
    }
    return `s3://${this.bucket}/${key}`;
  }
}

