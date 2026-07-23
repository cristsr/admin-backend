import { Transform } from 'class-transformer';

/**
 * Coerces an env-style value to a boolean: only the string `'true'` (or a real
 * `true`) is truthy. Avoids `Boolean('false')`, which is wrongly `true`.
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }) => value === true || value === 'true', {
    toClassOnly: true,
  });
}
