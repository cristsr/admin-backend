import { And, FindOperator } from 'typeorm';
import { ObjectLiteral } from '../types/object-literal';

/**
 * Writes `value` at a dotted `path` (`account.id` becomes `{ account: { id } }`),
 * mutating and returning `target`. Two operators that collide on the same leaf
 * are ANDed, composing a real range out of separate comparisons.
 */
export function assignAtPath(target: ObjectLiteral, path: string, value: unknown): ObjectLiteral {
  const segments = path.split('.');
  const leaf = segments.pop();

  const node = segments.reduce<ObjectLiteral>((current, segment) => {
    current[segment] = current[segment] ?? {};
    return current[segment] as ObjectLiteral;
  }, target);

  node[leaf] = merge(node[leaf], value);

  return target;
}

/** ANDs two operators that land on the same column; otherwise the new value wins. */
function merge(existing: unknown, value: unknown): unknown {
  if (existing instanceof FindOperator && value instanceof FindOperator) {
    return And(existing, value);
  }

  return value;
}
