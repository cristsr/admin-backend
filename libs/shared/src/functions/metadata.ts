import { Metadata } from '@grpc/grpc-js';
import { camelCase, kebabCase } from 'lodash';

export function plainToMeta(record: Record<any, any>): Metadata {
  const metadata = new Metadata();

  assignPlainToMeta(record, metadata);

  return metadata;
}

export function metaToPlain(meta: Metadata): Record<any, any> {
  const record: Record<any, any> = {};

  for (const [key, value] of Object.entries(meta.getMap())) {
    try {
      record[camelCase(key)] = JSON.parse(value.toString());
    } catch {
      record[camelCase(key)] = value.toString();
    }
  }

  return record;
}

export function assignPlainToMeta(
  record: Record<any, any>,
  metadata: Metadata
): void {
  Object.entries(record).forEach(([key, value]) => {
    metadata.set(kebabCase(key), value);
  });
}
