import * as v from 'valibot';

const spreadsheetFileSchema = v.custom<File>(
  (value) => value instanceof File,
  'file must be a File'
);

export const previewImportRequestSchema = v.object({
  file: spreadsheetFileSchema
});

export type PreviewImportRequest = v.InferOutput<typeof previewImportRequestSchema>;
