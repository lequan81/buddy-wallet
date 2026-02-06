import sharp from 'sharp';

export class ImageProcessor {
  /**
   * Process an image: rotate based on EXIF, resize if too large, convert to WebP
   */
  async process(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }) // reasonable max 1080p
      .webp({ quality: 80 }) // standardized to webp
      .toBuffer();
  }

  async getMetadata(buffer: Buffer) {
    return await sharp(buffer).metadata();
  }
}
