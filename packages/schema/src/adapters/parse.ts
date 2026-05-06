import { TypeCompiler } from '@sinclair/typebox/compiler';
import type { TSchema, Static } from '@sinclair/typebox';

export type ParsedSchemaResult<T> =
  | { success: true; output: T }
  | { success: false; errors: string[] };

export const parseSchema = <T extends TSchema>(
  schema: T,
  input: unknown
): ParsedSchemaResult<Static<T>> => {
  const compiled = TypeCompiler.Compile(schema);

  if (compiled.Check(input)) {
    return { success: true, output: input as Static<T> };
  }

  const errors = [...compiled.Errors(input)].map(
    (error) => `${error.path || 'input'}: ${error.message}`
  );

  return { success: false, errors };
};
