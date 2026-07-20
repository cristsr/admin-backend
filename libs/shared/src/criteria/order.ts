import { OrderType } from './order-type';

/** A single sort clause. Several of them compose a stable ordering. */
export class Order<TField extends string = string> {
  constructor(
    readonly field: TField,
    readonly type: OrderType,
  ) {}
}
