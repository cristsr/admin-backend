import { ColumnOptions, getMetadataArgsStorage } from 'typeorm';

/**
 * Money is stored as numeric(14,2): exact decimal arithmetic, never float.
 * The driver returns numeric as a string to avoid precision loss, so the
 * transformer maps it back to number for the domain. Aggregation must stay
 * in Postgres (SUM over numeric) — accumulating money in JS reintroduces
 * the float error this column type exists to avoid.
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
          from: (value: string) => (value === null ? null : Number(value)),
        },
        ...options,
      },
    });
  };
}
