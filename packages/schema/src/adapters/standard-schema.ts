import type { TSchema, Static } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

type ValidationIssue = { message: string; path?: (string | number | symbol)[] };


type TypeboxAdapter<TIn = any, TOut = TIn> = {
  superFormValidationLibrary: 'typebox';
  validate: (data: unknown) => Promise<
    | { success: true; data: TIn }
    | { success: false; issues: ValidationIssue[] }
  >;
  jsonSchema: Record<string, unknown>;
  '~standard': {
    version: 1;
    vendor: string;
    validate: (value: unknown) =>
      | { value: TOut }
      | { issues: ValidationIssue[] };
    types: {
      input: TOut;
      output: TOut;
    };
  };
};

/**
 * Wraps a TypeBox schema so it implements the Standard Schema v1 interface
 * and is compatible with sveltekit-superforms' ValidationAdapter.
 */
export function toStandardSchema<T extends TSchema>(schema: T): TypeboxAdapter<Static<T>, Static<T>> {
  const compiled = TypeCompiler.Compile(schema);

  const mapIssues = (errors: ReturnType<typeof compiled.Errors>) =>
    [...errors].map((e) => ({
      message: e.message,
      path: e.path
        ? e.path.split('/').filter(Boolean)
        : undefined,
    }));

  return {
    superFormValidationLibrary: 'typebox' as const,
    jsonSchema: {},
    validate: async (data: unknown) => {
      if (compiled.Check(data)) {
        return { data: data as Static<T>, success: true as const };
      }
      return {
        success: false as const,
        issues: mapIssues(compiled.Errors(data)),
      };
    },
    // Standard Schema v1 compatibility
    '~standard': {
      version: 1 as const,
      vendor: 'typebox',
      validate: (value: unknown) => {
        if (compiled.Check(value)) {
          return { value: value as Static<T> };
        }
        return {
          issues: mapIssues(compiled.Errors(value)),
        };
      },
      types: {
        input: undefined as unknown as Static<T>,
        output: undefined as unknown as Static<T>,
      },
    },
  };
}
