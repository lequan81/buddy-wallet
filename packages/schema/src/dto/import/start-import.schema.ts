import * as v from 'valibot';

export const importConfigSchema = v.object({
  mapping: v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    amount: v.pipe(v.string(), v.minLength(1)),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  }),
  startRow: v.pipe(v.number(), v.minValue(1)),
});

export const startImportRequestSchema = v.object({
  file: v.unknown(), // File instance — validated at runtime
  config: v.union([importConfigSchema, v.string()]),
  previewLogId: v.optional(v.string()),
});

export type ImportConfigRequest = v.InferOutput<typeof importConfigSchema>;
export type StartImportRequest = v.InferOutput<typeof startImportRequestSchema>;
