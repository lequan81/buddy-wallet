import { join } from 'path';
import { unlink } from 'node:fs/promises';

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

export class DiskStorageService implements IStorageService {
  constructor(private readonly uploadDir: string) {}

  async save(relativePath: string, buffer: Buffer | Blob): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    await Bun.write(fullPath, buffer);
    return relativePath; // Return relative path for DB storage
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(relativePath);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return Buffer.from(await file.arrayBuffer());
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    try {
      await unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
      console.warn(`Failed to delete file ${fullPath}:`, error);
    }
  }

  resolvePath(relativePath: string): string {
    return join(this.uploadDir, relativePath);
  }
}
