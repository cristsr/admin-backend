import { OrderType } from '../criteria';

/** The TypeORM sort keyword each domain order direction renders to. */
export const ORDER_DIRECTION: Readonly<Record<OrderType, 'ASC' | 'DESC'>> = {
  [OrderType.ASC]: 'ASC',
  [OrderType.DESC]: 'DESC',
};
