import * as v from 'valibot';

/**
 * Validate a single field value against a valibot schema.
 * Returns a validation state and message suitable for UI feedback.
 *
 * @param schema - A valibot schema describing the field
 * @param value  - The string value to validate (typically from a form input)
 */
export function validateField(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  value: string
): { state: 'default' | 'success' | 'error' | 'warning'; message: string } {
  if (value === '') return { state: 'default', message: '' };

  const result = v.safeParse(schema, value);

  if (result.success) {
    return { state: 'success', message: 'Valid' };
  }

  const firstIssue = result.issues[0];

  if (!firstIssue) return { state: 'error', message: 'Invalid' };

  // Regex / pattern issues are treated as warnings (partial-match feedback)
  const isWarning = firstIssue.type === 'string' && 'requirement' in firstIssue;

  return {
    state: isWarning ? 'warning' : 'error',
    message: firstIssue.message || 'Invalid',
  };
}
