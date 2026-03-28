import { t, type TSchema } from 'elysia';

// Helper to parse JSON string to object
// useful for handling multipart/form-data where JSON is sent as string
export const StringToJSON = <T extends TSchema>(schema: T) =>
  t.Union([
    schema,
    t
      .Transform(t.String())
      .Decode((value) => {
        try {
          return JSON.parse(value);
        } catch {
          throw new Error('Invalid JSON format');
        }
      })
      .Encode((value) => JSON.stringify(value))
  ]);

export const ImportConfigSchema = t.Object({
  mapping: t.Object({
    name: t.String({ minLength: 1 }),
    amount: t.String({ minLength: 1 }),
    phone: t.Optional(t.String({ pattern: '^\\d+$' })),
    email: t.Optional(t.String()),
    description: t.Optional(t.String()),
    dueDate: t.Optional(t.String())
  }),
  startRow: t.Number({ minimum: 1 })
});

export const SpreadsheetFileSchema = t.File({
  type: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv'
  ],
  maxSize: '5m'
});

export const PreviewImportSchema = t.Object({
  file: SpreadsheetFileSchema
});

export const StartImportSchema = t.Object({
  file: SpreadsheetFileSchema,
  config: StringToJSON(ImportConfigSchema),
  previewLogId: t.Optional(t.String())
});

export const ProgressSSEQuerySchema = t.Object({
  logIds: t.Optional(t.String())
});

export const ProgressBatchBodySchema = t.Object({
  logIds: t.Array(t.String())
});

export const LogsQuerySchema = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String())
});
