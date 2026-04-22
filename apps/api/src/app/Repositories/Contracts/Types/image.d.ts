/**
 * Image Service Type Definitions
 * Extracted from image.service.ts for decoupled type management.
 */

export interface ImageServiceConfig {
  format: 'webp' | 'jpeg';
  quality: number;
  maxWidth: number;
  maxHeight: number;
  timeoutSeconds: number;
}

