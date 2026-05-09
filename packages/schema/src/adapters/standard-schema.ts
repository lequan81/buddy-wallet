import type * as v from 'valibot';

/**
 * Wraps a valibot schema for use with sveltekit-superforms' `form()` remote functions.
 *
 * Valibot schemas natively implement the Standard Schema v1 interface (`~standard`),
 * so this function simply returns the schema as-is. It exists to maintain the same
 * call-site API (`toStandardSchema(schema)`) used throughout the codebase.
 */
export function toStandardSchema<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema
): TSchema {
  return schema;
}
