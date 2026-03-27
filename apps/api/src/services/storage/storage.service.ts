import { resolve } from 'path';
import { unlink } from 'node:fs/promises';

import type { IStorageService } from '@/types';

export class DiskStorageService implements IStorageService {
  constructor(private readonly uploadDir: string) {}

  async save(relativePath: string, buffer: Buffer | Blob): Promise<string> {
    const fullPath = this.resolvePath(relativePath);

    // FIX EXDEV & OOM: Force reading stream safely
    // If Bun internally tries an fs.rename for Blob types across drives, it fails.
    // Streaming it chunks the copy, dodging out-of-memory crashes for small servers.
    if (buffer instanceof Blob) {
      await Bun.write(fullPath, new Response(buffer.stream()));
    } else {
      await Bun.write(fullPath, buffer);
    }
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
    const absoluteUploadDir = resolve(this.uploadDir);
    const fullPath = resolve(absoluteUploadDir, relativePath);

    // SECURITY: Prevent path traversal
    if (!fullPath.startsWith(absoluteUploadDir)) {
      throw new Error('Invalid path: Directory traversal attempt');
    }

    return fullPath;
  }
}
