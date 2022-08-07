import { join } from 'path';

export function resolveProto(name: string) {
  return join(__dirname, 'assets', name + '.proto');
}
