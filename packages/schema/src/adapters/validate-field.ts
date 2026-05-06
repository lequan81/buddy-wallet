import { TypeCompiler } from '@sinclair/typebox/compiler';
import type { TSchema } from '@sinclair/typebox';

/**
 * Validate a single field value against a TypeBox schema.
 * Returns a validation state and message suitable for UI feedback.
 *
 * This is the TypeBox equivalent of the valibot-based validateField from @repo/validation.
 *
 * @param schema - A TypeBox schema describing the field
 * @param value  - The string value to validate (typically from a form input)
 */
export function validateField(
  schema: TSchema,
  value: string
): { state: 'default' | 'success' | 'error' | 'warning'; message: string } {
  if (value === '') return { state: 'default', message: '' };

  const compiled = TypeCompiler.Compile(schema);

  if (compiled.Check(value)) {
    return { state: 'success', message: 'Valid' };
  }

  const errors = [...compiled.Errors(value)];
  const firstError = errors[0];

  if (!firstError) return { state: 'error', message: 'Invalid' };

  // Pattern / regex errors are treated as warnings (partial-match feedback)
  const isWarning = String(firstError.type) === 'Pattern';

  return {
    state: isWarning ? 'warning' : 'error',
    message: firstError.message || 'Invalid',
  };
}
