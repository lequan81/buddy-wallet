import * as v from 'valibot';

export function validateField(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  value: string
): { state: 'default' | 'success' | 'error' | 'warning'; message: string } {
  if (value === '') return { state: 'default', message: '' };
  const result = v.safeParse(schema, value);
  if (result.success) return { state: 'success', message: 'Valid' };
  const issue = result.issues[0];
  const isWarning = issue?.type === 'regex';
  return {
    state: isWarning ? 'warning' : 'error',
    message: issue?.message || 'Invalid'
  };
}
