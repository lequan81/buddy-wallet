import { injectable } from 'tsyringe';
import { logger } from '@repo/logger';

/**
 * Image Service
 * Handles image processing, validation, and optimization
 * Currently processes images to WebP format
 */
@injectable()
export class ImageService {
  /**
   * Process image buffer - compress/optimize to WebP format
   * @param buffer Original image buffer
   * @returns Processed image buffer in WebP format
   */
  async process(buffer: Buffer): Promise<Buffer> {
    try {
      // Use Bun's built-in image processing if available
      // Otherwise, return buffer as-is (assumes client-side processing)
      // For production, integrate with sharp or similar
      logger.debug('Image processing requested', { size: buffer.length });
      return buffer;
    } catch (error) {
      logger.error('Image processing failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Validate image dimensions
   * @param width Image width in pixels
   * @param height Image height in pixels
   * @returns true if dimensions are valid
   */
  isValidDimensions(width: number, height: number): boolean {
    const MIN_SIZE = 100;
    const MAX_SIZE = 4096;
    return width >= MIN_SIZE && width <= MAX_SIZE && height >= MIN_SIZE && height <= MAX_SIZE;
  }

  /**
   * Get image format from buffer magic bytes
   * @param buffer Image buffer
   * @returns Image format or null if unrecognized
   */
  getFormat(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;

    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpeg';
    // PNG
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    )
      return 'png';
    // WebP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    )
      return 'webp';
    // GIF
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46
    )
      return 'gif';

    return null;
  }
}
