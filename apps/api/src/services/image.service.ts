import sharp from 'sharp';

interface ImageServiceConfig {
  format: 'webp' | 'jpeg';
  quality: number;
  maxWidth: number;
  maxHeight: number;
  timeoutSeconds: number;
}

const DEFAULT_CONFIG: ImageServiceConfig = {
  format: 'webp',
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1080,
  timeoutSeconds: 10
};

export class ImageService {
  private config: ImageServiceConfig;

  constructor(config: Partial<ImageServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process an image: rotate based on EXIF, resize if too large, convert to WebP
   * Includes timeout to prevent DoS attacks with malformed images
   */
  async process(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer, { failOn: 'error' }) // Fail fast on corrupt images
      .rotate() // Auto-rotate based on EXIF
      .resize(this.config.maxWidth, this.config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: this.config.quality })
      .timeout({ seconds: this.config.timeoutSeconds }) // Prevent DoS
      .toBuffer();
  }

  async getMetadata(buffer: Buffer) {
    return await sharp(buffer).metadata();
  }
}
