import * as v from 'valibot';

export type ParsedSchemaResult<T> =
  | { success: true; output: T }
  | { success: false; errors: string[] };

export const parseSchema = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  input: unknown
): ParsedSchemaResult<v.InferOutput<TSchema>> => {
  const result = v.safeParse(schema, input);

  if (result.success) {
    return { success: true, output: result.output };
  }

  const errors = result.issues.map(
    (issue) => `${issue.path?.map((p) => p.key).join('.') || 'input'}: ${issue.message}`
  );

  return { success: false, errors };
};
