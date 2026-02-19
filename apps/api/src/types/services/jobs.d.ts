export interface JobPayload {
  file?: File;
  userId: string | { id: string; phoneNumber: string | null };
  fileName?: string;
  config?: unknown;
  previewLogId?: string;
}
