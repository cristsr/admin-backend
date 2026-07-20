import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../functions/pagination';
import { Criteria } from './criteria';
import { FilterOperator } from './filter-operator';
import { InvalidCriteriaException } from './invalid-criteria.exception';
import { OrderType } from './order-type';

type Field = 'user' | 'amount' | 'date' | 'merchant' | 'type';

const empty = () => Criteria.none<Field>();

describe('Criteria', () => {
  it('starts with nothing to match, sort or page', () => {
    const criteria = empty();

    expect(criteria.hasFilters).toBe(false);
    expect(criteria.hasOrders).toBe(false);
    expect(criteria.isPaginated).toBe(false);
  });

  it('is immutable: every builder call returns a new instance', () => {
    const criteria = empty();
    const narrowed = criteria.equals('user', 7);

    expect(narrowed).not.toBe(criteria);
    expect(criteria.hasFilters).toBe(false);
    expect(narrowed.filters).toHaveLength(1);
  });

  it('appends filters in the order they were stated', () => {
    const criteria = empty().equals('user', 7).greaterThan('amount', 100);

    expect(criteria.filters.map((filter) => filter.field)).toEqual([
      'user',
      'amount',
    ]);
    expect(criteria.filters[1].operator).toBe(FilterOperator.GREATER_THAN);
  });

  describe('absent values', () => {
    it('drops a scalar filter whose value is undefined or null', () => {
      const criteria = empty().equals('user', undefined).equals('type', null);

      expect(criteria.hasFilters).toBe(false);
    });

    it('keeps falsy values that are real: zero and empty-but-present', () => {
      const criteria = empty().equals('amount', 0);

      expect(criteria.filters).toHaveLength(1);
      expect(criteria.filters[0].value).toBe(0);
    });

    it('drops an empty membership list rather than matching nothing', () => {
      expect(empty().oneOf('type', []).hasFilters).toBe(false);
      expect(empty().oneOf('type', undefined).hasFilters).toBe(false);
    });

    it('drops a blank needle from contains', () => {
      expect(empty().contains('merchant', '   ').hasFilters).toBe(false);
    });

    it('still allows matching against NULL explicitly', () => {
      const criteria = empty().isNull('merchant');

      expect(criteria.filters[0].operator).toBe(FilterOperator.IS_NULL);
    });
  });

  describe('between', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-12-31');

    it('builds an inclusive range when both bounds are given', () => {
      const [filter] = empty().between('date', from, to).filters;

      expect(filter.operator).toBe(FilterOperator.BETWEEN);
      expect(filter.values).toEqual([from, to]);
    });

    it('degrades to >= when only the lower bound is given', () => {
      const [filter] = empty().between('date', from, undefined).filters;

      expect(filter.operator).toBe(FilterOperator.GREATER_OR_EQUAL);
      expect(filter.value).toBe(from);
    });

    it('degrades to <= when only the upper bound is given', () => {
      const [filter] = empty().between('date', null, to).filters;

      expect(filter.operator).toBe(FilterOperator.LESS_OR_EQUAL);
      expect(filter.value).toBe(to);
    });

    it('drops the filter entirely when neither bound is given', () => {
      expect(empty().between('date').hasFilters).toBe(false);
    });
  });

  describe('ordering', () => {
    it('keeps sort clauses in declaration order, so the first breaks ties last', () => {
      const criteria = empty()
        .orderBy('date', OrderType.DESC)
        .orderBy('amount', OrderType.ASC);

      expect(criteria.orders.map((order) => order.field)).toEqual([
        'date',
        'amount',
      ]);
      expect(criteria.orders[0].type).toBe(OrderType.DESC);
    });

    it('defaults to ascending', () => {
      expect(empty().orderBy('amount').orders[0].type).toBe(OrderType.ASC);
    });
  });

  describe('pagination', () => {
    it('applies the shared defaults when the caller states nothing', () => {
      expect(empty().paginate({}).pagination).toEqual({
        take: DEFAULT_PAGE_SIZE,
        skip: 0,
      });
    });

    it('caps an oversized page so a caller cannot ask for the whole table', () => {
      expect(empty().paginate({ limit: 100_000 }).pagination.take).toBe(
        MAX_PAGE_SIZE,
      );
    });

    it('limitTo bounds a batch without an offset', () => {
      expect(empty().limitTo(5).pagination).toEqual({ take: 5, skip: 0 });
    });
  });

  describe('invalid filters', () => {
    it('refuses a between with a single bound', () => {
      expect(() =>
        empty().where('date', FilterOperator.BETWEEN, [new Date()]),
      ).toThrow(InvalidCriteriaException);
    });

    it('refuses a list operator with a scalar value', () => {
      expect(() => empty().where('type', FilterOperator.IN, 'EXPENSE')).toThrow(
        InvalidCriteriaException,
      );
    });

    it('refuses a comparison with no value at all', () => {
      expect(() => empty().where('amount', FilterOperator.EQUAL)).toThrow(
        InvalidCriteriaException,
      );
    });
  });
});
