import { FindOperator } from 'typeorm';
import { Criteria } from '../criteria/criteria';
import { FilterOperator } from '../criteria/filter-operator';
import { InvalidCriteriaException } from '../criteria/invalid-criteria.exception';
import { OrderType } from '../criteria/order-type';
import {
  CriteriaFieldMap,
  TypeOrmCriteriaConverter,
} from './typeorm-criteria.converter';

type Field = 'id' | 'user' | 'account' | 'amount' | 'date' | 'merchant';

const fields: CriteriaFieldMap<Field> = {
  id: 'id',
  user: 'user',
  account: 'account.id',
  amount: 'amount',
  date: 'date',
  merchant: 'merchant',
};

const converter = new TypeOrmCriteriaConverter<Record<string, never>, Field>(
  fields,
);

const empty = () => Criteria.none<Field>();

/** The operator type TypeORM will render, e.g. `moreThan`. */
const typeOf = (value: unknown) =>
  value instanceof FindOperator ? value.type : value;

describe('TypeOrmCriteriaConverter', () => {
  it('maps each domain field to the property path that backs it', () => {
    const where = converter.toWhere(empty().equals('account', 3)) as any;

    expect(typeOf(where.account.id)).toBe('equal');
    expect(where.account.id.value).toBe(3);
  });

  it('translates every operator to its TypeORM counterpart', () => {
    const where = converter.toWhere(
      empty()
        .equals('id', 1)
        .notEquals('user', 2)
        .greaterThan('amount', 10)
        .lessOrEqual('date', new Date('2026-01-01'))
        .contains('merchant', 'uber'),
    ) as any;

    expect(typeOf(where.id)).toBe('equal');
    expect(typeOf(where.user)).toBe('not');
    expect(typeOf(where.amount)).toBe('moreThan');
    expect(typeOf(where.date)).toBe('lessThanOrEqual');
    expect(typeOf(where.merchant)).toBe('ilike');
    expect(where.merchant.value).toBe('%uber%');
  });

  it('matches the whole value for a case-insensitive equality', () => {
    const where = converter.toWhere(
      empty().equalsIgnoreCase('merchant', 'Uber'),
    ) as any;

    expect(typeOf(where.merchant)).toBe('ilike');
    expect(where.merchant.value).toBe('Uber');
  });

  it('ANDs two conditions on the same column into one range', () => {
    const where = converter.toWhere(
      empty().greaterThan('amount', 10).lessThan('amount', 100),
    ) as any;

    expect(typeOf(where.amount)).toBe('and');
    expect(where.amount.value).toHaveLength(2);
  });

  it('turns a null check into IS NULL rather than a comparison with null', () => {
    const where = converter.toWhere(empty().isNull('merchant')) as any;
    const notNull = converter.toWhere(empty().isNotNull('merchant')) as any;

    expect(typeOf(where.merchant)).toBe('isNull');
    expect(typeOf(notNull.merchant)).toBe('not');
  });

  it('carries ordering and paging into the find options', () => {
    const options = converter.toFindOptions(
      empty()
        .orderBy('date', OrderType.DESC)
        .orderBy('account', OrderType.ASC)
        .paginate({ limit: 20, offset: 40 }),
    );

    expect(options.order).toEqual({ date: 'DESC', account: { id: 'ASC' } });
    expect(options.take).toBe(20);
    expect(options.skip).toBe(40);
  });

  it('leaves take and skip unset when the criteria is not paginated', () => {
    const options = converter.toFindOptions(empty().equals('id', 1));

    expect(options.take).toBeUndefined();
    expect(options.skip).toBeUndefined();
  });

  it('refuses a field the adapter never mapped', () => {
    const unmapped = new TypeOrmCriteriaConverter<Record<string, never>, Field>(
      { id: 'id' } as CriteriaFieldMap<Field>,
    );

    expect(() => unmapped.toWhere(empty().equals('amount', 1))).toThrow(
      InvalidCriteriaException,
    );
  });

  it('renders a membership filter as IN', () => {
    const where = converter.toWhere(
      empty().where('id', FilterOperator.IN, [1, 2, 3]),
    ) as any;

    expect(typeOf(where.id)).toBe('in');
    expect(where.id.value).toEqual([1, 2, 3]);
  });
});
