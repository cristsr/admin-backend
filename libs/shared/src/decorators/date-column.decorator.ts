import { ColumnOptions, getMetadataArgsStorage } from 'typeorm';

export function DateColumn(options?: ColumnOptions): PropertyDecorator {
  return function (object: any, propertyName: string) {
    getMetadataArgsStorage().columns.push({
      target: object.constructor,
      propertyName: propertyName,
      mode: 'regular',
      options: {
        type: 'timestamp with time zone',
        ...options,
      },
    });
  };
}
