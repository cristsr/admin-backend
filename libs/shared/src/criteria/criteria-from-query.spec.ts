import { Criteria } from './criteria';
import { criteriaFromQuery } from './criteria-from-query';
import { CriteriaQueryDto } from './criteria-query.dto';
import { CriteriaSchema, CriteriaValueType, IDENTITY_OPERATORS } from './criteria-schema';
import { FilterOperator } from './filter-operator';
import { InvalidCriteriaException } from './invalid-criteria.exception';
import { OrderType } from './order-type';

type Field = 'user' | 'amount' | 'date' | 'merchant' | 'type' | 'isSettled';

const schema: CriteriaSchema<Field> = {
  amount: { type: CriteriaValueType.NUMBER, isSortable: true },
  date: { type: CriteriaValueType.DATE, isSortable: true },
  merchant: { type: CriteriaValueType.STRING, isNullable: true },
  type: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  isSettled: { type: CriteriaValueType.BOOLEAN },
};

const query = (partial: Partial<CriteriaQueryDto>): CriteriaQueryDto => partial as CriteriaQueryDto;

describe('criteriaFromQuery', () => {
  it('always paginates, so a list endpoint can never return the whole table', () => {
    expect(criteriaFromQuery(null, schema).isPaginated).toBe(true);
  });

  it('coerces each raw value against the type the schema declares', () => {
    const criteria = criteriaFromQuery(
      query({
        filters: [
          { field: 'amount', operator: FilterOperator.GREATER_THAN, value: '100' },
          { field: 'date', operator: FilterOperator.LESS_THAN, value: '2026-03-01' },
          { field: 'isSettled', operator: FilterOperator.EQUAL, value: 'true' },
        ],
      }),
      schema,
    );

    expect(criteria.filters[0].value).toBe(100);
    expect(criteria.filters[1].value).toEqual(new Date('2026-03-01'));
    expect(criteria.filters[2].value).toBe(true);
  });

  it('reads a list operator from either a comma-separated string or repeated entries', () => {
    const fromCsv = criteriaFromQuery(
      query({
        filters: [{ field: 'type', operator: FilterOperator.IN, value: 'EXPENSE, INCOME' }],
      }),
      schema,
    );
    const fromArray = criteriaFromQuery(
      query({
        filters: [
          {
            field: 'type',
            operator: FilterOperator.IN,
            value: ['EXPENSE', 'INCOME'],
          },
        ],
      }),
      schema,
    );

    expect(fromCsv.filters[0].values).toEqual(['EXPENSE', 'INCOME']);
    expect(fromArray.filters[0].values).toEqual(['EXPENSE', 'INCOME']);
  });

  describe('the base criteria the server imposes', () => {
    const base = Criteria.none<Field>().equals('user', 7);

    it('survives a query that filters on other fields', () => {
      const criteria = criteriaFromQuery(
        query({
          filters: [{ field: 'amount', operator: FilterOperator.EQUAL, value: '10' }],
        }),
        schema,
        base,
      );

      expect(criteria.filters[0].field).toBe('user');
      expect(criteria.filters[0].value).toBe(7);
    });

    it('cannot be widened: a field kept out of the schema is refused', () => {
      expect(() =>
        criteriaFromQuery(
          query({
            filters: [{ field: 'user', operator: FilterOperator.EQUAL, value: '9' }],
          }),
          schema,
          base,
        ),
      ).toThrow(InvalidCriteriaException);
    });
  });

  describe('rejections', () => {
    it('refuses an unknown field', () => {
      expect(() =>
        criteriaFromQuery(
          query({
            filters: [{ field: 'nope', operator: FilterOperator.EQUAL, value: '1' }],
          }),
          schema,
        ),
      ).toThrow(InvalidCriteriaException);
    });

    it('refuses an operator the field does not accept', () => {
      expect(() =>
        criteriaFromQuery(
          query({
            filters: [
              {
                field: 'type',
                operator: FilterOperator.CONTAINS,
                value: 'EXP',
              },
            ],
          }),
          schema,
        ),
      ).toThrow(InvalidCriteriaException);
    });

    it('refuses a null check on a field that did not opt into one', () => {
      expect(() =>
        criteriaFromQuery(
          query({
            filters: [{ field: 'amount', operator: FilterOperator.IS_NULL }],
          }),
          schema,
        ),
      ).toThrow(InvalidCriteriaException);
    });

    it('allows a null check on a field that did', () => {
      const criteria = criteriaFromQuery(
        query({
          filters: [{ field: 'merchant', operator: FilterOperator.IS_NULL }],
        }),
        schema,
      );

      expect(criteria.filters[0].operator).toBe(FilterOperator.IS_NULL);
    });

    it('refuses a value that will not coerce', () => {
      expect(() =>
        criteriaFromQuery(
          query({
            filters: [{ field: 'amount', operator: FilterOperator.EQUAL, value: 'ten' }],
          }),
          schema,
        ),
      ).toThrow(InvalidCriteriaException);
    });

    it('refuses sorting by a field that is not sortable', () => {
      expect(() => criteriaFromQuery(query({ orderBy: 'merchant' }), schema)).toThrow(
        InvalidCriteriaException,
      );
    });
  });

  it('sorts ascending unless the caller says otherwise', () => {
    expect(criteriaFromQuery(query({ orderBy: 'date' }), schema).orders[0].type).toBe(OrderType.ASC);
    expect(criteriaFromQuery(query({ orderBy: 'date', order: OrderType.DESC }), schema).orders[0].type).toBe(
      OrderType.DESC,
    );
  });
});
