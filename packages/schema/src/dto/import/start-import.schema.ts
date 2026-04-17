import * as v from 'valibot';

const spreadsheetFileSchema = v.custom<File>(
  (value) => value instanceof File,
  'file must be a File'
);

export const importConfigSchema = v.object({
  mapping: v.object({
    name: v.pipe(v.string(), v.minLength(1, 'mapping.name is required')),
    amount: v.pipe(v.string(), v.minLength(1, 'mapping.amount is required')),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string())
  }),
  startRow: v.pipe(v.number(), v.minValue(1, 'startRow must be >= 1'))
});

const importConfigFromJsonSchema = v.pipe(
  v.string(),
  v.transform((value) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }),
  importConfigSchema
);

export const startImportRequestSchema = v.object({
  file: spreadsheetFileSchema,
  config: v.union([importConfigSchema, importConfigFromJsonSchema]),
  previewLogId: v.optional(v.string())
});

export type ImportConfigRequest = v.InferOutput<typeof importConfigSchema>;
export type StartImportRequest = v.InferOutput<typeof startImportRequestSchema>;
