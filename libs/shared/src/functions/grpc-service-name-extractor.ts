import { readFileSync } from 'fs';
import { join } from 'path';

export function GrpcServiceNameExtractor(...paths: string[]) {
  const path = join(...paths);
  const content = readFileSync(path, 'utf-8');

  const serviceRegex = /service\s+([^\s{]+)/g;
  const match = serviceRegex.exec(content);

  if (match && match[1]) {
    return match[1]; // Devuelve el nombre del servicio encontrado
  }

  throw new TypeError('Service not found at ' + path);
}
