import { configs } from '@/configs';
import type { IStorageService } from '@/types';

const UPLOAD_NAMESPACE = 'uploads';
const PROOF_NAMESPACE = 'proofs';

const normalizeStoragePath = (rawPath: string): string =>
  rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

const toOptional = (value: string): string | undefined => (value ? value : undefined);

export class S3StorageService implements IStorageService {
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
      console.warn(`Failed to delete file s3://${this.bucket}/${key}:`, error);
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

export const createStorageServices = (): {
  uploadStorage: IStorageService;
  proofStorage: IStorageService;
} => {
  const s3Client = new Bun.S3Client({
    endpoint: toOptional(configs.STORAGE.S3_ENDPOINT),
    region: toOptional(configs.STORAGE.S3_REGION),
    bucket: toOptional(configs.STORAGE.S3_BUCKET),
    accessKeyId: toOptional(configs.STORAGE.S3_ACCESS_KEY_ID),
    secretAccessKey: toOptional(configs.STORAGE.S3_SECRET_ACCESS_KEY),
    virtualHostedStyle: !configs.STORAGE.S3_FORCE_PATH_STYLE
  });

  return {
    uploadStorage: new S3StorageService(
      s3Client,
      UPLOAD_NAMESPACE,
      configs.STORAGE.S3_BUCKET,
      toOptional(configs.STORAGE.S3_PUBLIC_BASE_URL)
    ),
    proofStorage: new S3StorageService(
      s3Client,
      PROOF_NAMESPACE,
      configs.STORAGE.S3_BUCKET,
      toOptional(configs.STORAGE.S3_PUBLIC_BASE_URL)
    )
  };
};
