import { Type, type Static } from '@sinclair/typebox';

export const previewImportRequestSchema = Type.Object({
  file: Type.Unknown() // File instance — validated at runtime
});

export type PreviewImportRequest = Static<typeof previewImportRequestSchema>;
