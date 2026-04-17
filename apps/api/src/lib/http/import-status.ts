const statusMap: Record<string, string> = {
  pending: 'queued'
};

export function normalizeImportStatus(status: string | undefined): string | undefined {
  if (!status) return status;
  return statusMap[status] || status;
}
