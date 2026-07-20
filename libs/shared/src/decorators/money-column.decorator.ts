import { ColumnOptions, getMetadataArgsStorage } from 'typeorm';

/**
 * Money column as numeric(14,2): exact decimal, never float. The driver
 * returns numeric as string, so the transformer maps it back to number.
 */
export function MoneyColumn(options?: ColumnOptions): PropertyDecorator {
  return function (object: any, propertyName: string) {
    getMetadataArgsStorage().columns.push({
      target: object.constructor,
      propertyName: propertyName,
      mode: 'regular',
      options: {
        type: 'numeric',
        precision: 14,
        scale: 2,
        transformer: {
          to: (value: number) => value,
          from: (value: string) => {
            // The driver hands back null for NULL rows despite the string type.
            if (!value) return null;

            return Number(value);
          },
        },
        ...options,
      },
    });
  };
}
