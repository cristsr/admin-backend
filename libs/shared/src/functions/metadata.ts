import { Metadata } from '@grpc/grpc-js';
import { camelCase, kebabCase } from 'lodash';

export function plainToMeta(record: Record<any, any>): Metadata {
  const metadata = new Metadata();

  Object.entries(record).forEach(([key, value]) => {
    metadata.set(kebabCase(key), value);
  });

  return metadata;
}

export function metaToPlain(meta: Metadata): Record<any, any> {
  const record: Record<any, any> = {};

  for (const [key, value] of Object.entries(meta.getMap())) {
    record[camelCase(key)] = value;
  }

  return record;
}
