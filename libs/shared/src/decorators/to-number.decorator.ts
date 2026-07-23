import { Transform } from 'class-transformer';

/**
 * Coerces an incoming value to a number for validation. An empty string or a
 * nullish value becomes `undefined` so `@IsOptional` treats it as unset; any
 * non-numeric value stays `NaN` so `@IsNumber` can reject it (fail-fast).
 */
export function ToNumber(): PropertyDecorator {
  return Transform(
    ({ value }) => (value === '' || value == null ? undefined : Number(value)),
    { toClassOnly: true },
  );
}
