import * as v from 'valibot';

export const previewImportRequestSchema = v.object({
  file: v.unknown(), // File instance — validated at runtime
});

export type PreviewImportRequest = v.InferOutput<typeof previewImportRequestSchema>;
