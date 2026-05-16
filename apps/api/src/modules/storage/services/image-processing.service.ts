/**
 * Image Processing Service - Pure Functions
 * @logicType backend
 *
 * Uses Bun.Image for native image processing with EXIF removal.
 * All processed images have EXIF metadata stripped after orientation correction.
 */

// OOM protection: maxPixels = 4096 * 4096 = ~16.7M pixels (matches Sharp default)
const MAX_PIXELS = 4096 * 4096;

export async function processAvatar(buffer: Buffer): Promise<{
  thumbnail: Buffer;
  medium: Buffer;
}> {
  // Load image with auto-orientation (applies EXIF rotation)
  const img = new Bun.Image(buffer, { maxPixels: MAX_PIXELS, autoOrient: true });

  // Thumbnail: 64x64 WebP quality 85
  // WebP encoding automatically strips EXIF data (reduces size 30-50%)
  const thumbnail = Buffer.from(
    await img
      .resize(64, 64, { fit: 'inside' })
      .webp({ quality: 85 })
      .bytes()
  );

  // Medium: 400x400 WebP quality 85
  // WebP encoding automatically strips EXIF data (reduces size 30-50%)
  const medium = Buffer.from(
    await img
      .resize(400, 400, { fit: 'inside' })
      .webp({ quality: 85 })
      .bytes()
  );

  return { thumbnail, medium };
}

export async function processProof(buffer: Buffer): Promise<{
  display: Buffer;
  download: Buffer;
}> {
  // Load image with auto-orientation (applies EXIF rotation)
  const img = new Bun.Image(buffer, { maxPixels: MAX_PIXELS, autoOrient: true });

  // Display version: max 1920x1080 WebP quality 80
  // WebP encoding automatically strips EXIF data (reduces size 30-50%)
  const display = Buffer.from(
    await img
      .resize(1920, 1080, { fit: 'inside' })
      .webp({ quality: 80 })
      .bytes()
  );

  // Download version: max 1920x1080 JPEG quality 100
  // JPEG encoding automatically strips EXIF data (reduces size 30-50%)
  const download = Buffer.from(
    await img
      .resize(1920, 1080, { fit: 'inside' })
      .jpeg({ quality: 100 })
      .bytes()
  );

  return { display, download };
}
