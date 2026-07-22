import { OrderType } from './order-type';

export class Order<TField extends string = string> {
  constructor(
    readonly field: TField,
    readonly type: OrderType,
  ) {}
}

/**
 * A sort clause expressed declaratively. `type` is optional so callers can
 * lean on the ascending default.
 */
export interface OrderClause<TField extends string = string> {
  readonly field: TField;
  readonly type?: OrderType;
}
