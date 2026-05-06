import { Type, type Static } from '@sinclair/typebox';

export const importConfigSchema = Type.Object({
  mapping: Type.Object({
    name: Type.String({ minLength: 1 }),
    amount: Type.String({ minLength: 1 }),
    phone: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    dueDate: Type.Optional(Type.String())
  }),
  startRow: Type.Number({ minimum: 1 })
});

export const startImportRequestSchema = Type.Object({
  file: Type.Unknown(), // File instance — validated at runtime
  config: Type.Union([importConfigSchema, Type.String()]),
  previewLogId: Type.Optional(Type.String())
});

export type ImportConfigRequest = Static<typeof importConfigSchema>;
export type StartImportRequest = Static<typeof startImportRequestSchema>;
