/**
 * Storage Service Type Definitions
 * Extracted from storage.service.ts for decoupled type management.
 */

export interface IStorageService {
  /**
   * Save a file buffer to storage
   * @param path Relative path to save (e.g., 'proofs/file.webp')
   * @param buffer File content
   * @returns Public URL or stored path
   */
  save(path: string, buffer: Buffer | Blob): Promise<string>;

  /**
   * Read a file from storage
   * @param path Relative path to read
   * @returns File content as Buffer
   */
  read(path: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param path Relative path to delete
   */
  delete(path: string): Promise<void>;

  /**
   * Get full system path (for disk storage) or signed URL (for S3)
   */
  resolvePath(path: string): string;
}
