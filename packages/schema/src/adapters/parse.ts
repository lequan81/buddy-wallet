import * as v from 'valibot';

export type ParsedSchemaResult<T> =
  | { success: true; output: T }
  | { success: false; errors: string[] };

const formatIssuePath = (path: v.IssuePathItem[] | undefined): string => {
  if (!path || path.length === 0) {
    return 'input';
  }

  return path
    .map((item) => {
      if ('key' in item && item.key !== undefined) return String(item.key);
      if ('index' in item && item.index !== undefined) return String(item.index);
      return 'input';
    })
    .join('.');
};

export const toIssueMessages = (issues: v.BaseIssue<unknown>[]): string[] => {
  return issues.map((issue) => {
    const path = formatIssuePath(issue.path);
    return `${path}: ${issue.message}`;
  });
};

export const parseSchema = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  input: unknown
): ParsedSchemaResult<v.InferOutput<TSchema>> => {
  const result = v.safeParse(schema, input);

  if (result.success) {
    return { success: true, output: result.output };
  }

  return {
    success: false,
    errors: toIssueMessages(result.issues)
  };
};
