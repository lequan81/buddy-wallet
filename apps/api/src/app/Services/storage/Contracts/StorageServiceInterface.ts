export interface StorageServiceInterface {
  save(relativePath: string, buffer: Buffer | Blob): Promise<string>;
  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
  resolvePath(relativePath: string): string;
}
