import { OrderType } from './order-type';

export class Order<TField extends string = string> {
  constructor(
    readonly field: TField,
    readonly type: OrderType,
  ) {}
}
