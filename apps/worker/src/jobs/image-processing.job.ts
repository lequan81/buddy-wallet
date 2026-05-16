/**
 * Image Processing Job Handler
 * @logicType worker
 *
 * Processes avatar and payment proof images using Bun.Image.
 * Handles async image processing with progress tracking.
 */

import { logger } from '@repo/logger';
import { STORAGE_CONFIG, buildS3Endpoint } from '@repo/config';
import { toOptional } from '@repo/utils';
import type { WorkerJobPayload } from '@repo/types';
import { setProgress, clearProgressCache, getRedis } from '../redis';
import { processAvatar, processProof } from '@repo/api/modules/storage/services/image-processing.service';

// Build endpoint with auto-protocol detection
const resolvedEndpoint = buildS3Endpoint(STORAGE_CONFIG.ENDPOINT, STORAGE_CONFIG.SSL);

const s3Client = new Bun.S3Client({
  endpoint: toOptional(resolvedEndpoint),
  region: toOptional(STORAGE_CONFIG.REGION),
  bucket: toOptional(STORAGE_CONFIG.BUCKET),
  accessKeyId: toOptional(STORAGE_CONFIG.ACCESS_KEY),
  secretAccessKey: toOptional(STORAGE_CONFIG.SECRET_KEY),
  virtualHostedStyle: !STORAGE_CONFIG.FORCE_PATH_STYLE
});

export async function processImageJob(payload: WorkerJobPayload) {
  const { jobId, storageKey, imageType, userId } = payload;
  
  if (!storageKey) {
    throw new Error('storageKey is required');
  }
  
  try {
    setProgress(jobId, { 
      status: 'processing', 
      current: 0,
      total: 1,
      percentage: 0,
      message: 'Fetching image from storage...' 
    });
    
    // Fetch original from S3
    const sourceFile = s3Client.file(storageKey);
    if (!(await sourceFile.exists())) {
      throw new Error(`File not found: ${storageKey}`);
    }
    const buffer = Buffer.from(await sourceFile.arrayBuffer());
    
    setProgress(jobId, { 
      status: 'processing', 
      current: 1,
      total: 2,
      percentage: 50,
      message: 'Processing image...' 
    });
    
    if (imageType === 'avatar') {
      const { thumbnail, medium } = await processAvatar(buffer);
      
      // Store processed versions (delete original)
      const baseKey = storageKey.replace(/\.[^.]+$/, '');
      await s3Client.write(`${baseKey}-thumbnail.webp`, thumbnail);
      await s3Client.write(`${baseKey}-medium.webp`, medium);
      await s3Client.delete(storageKey);
      
      setProgress(jobId, { 
        status: 'success', 
        current: 2,
        total: 2,
        percentage: 100,
        message: 'Avatar processed successfully'
      });
    } else if (imageType === 'proof') {
      const { display, download } = await processProof(buffer);
      
      // Store processed versions + keep original
      const baseKey = storageKey.replace(/\.[^.]+$/, '');
      await s3Client.write(`${baseKey}-display.webp`, display);
      await s3Client.write(`${baseKey}-download.jpg`, download);
      
      setProgress(jobId, { 
        status: 'success', 
        current: 2,
        total: 2,
        percentage: 100,
        message: 'Proof processed successfully'
      });
    }
  } catch (err) {
    logger.error(`[ImageJob:${jobId}] Failed`, { error: String(err) });
    setProgress(jobId, { 
      status: 'failed', 
      current: 0,
      total: 1,
      percentage: 0,
      errors: [String(err)] 
    });
  } finally {
    clearProgressCache(jobId);
  }
}
