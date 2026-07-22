import { normalizePagination } from '../functions/pagination';
import { PaginationInput } from '../functions/pagination-input.type';
import { Pagination } from '../functions/pagination.type';
import { Nullable } from '../types/nullable.type';
import { Filter, FilterScalar, FilterValue } from './filter';
import { FilterOperator } from './filter-operator';
import { Order, OrderClause } from './order';
import { OrderType } from './order-type';

/**
 * Persistence-agnostic query (filters, ordering, pagination). Immutable:
 * every builder returns a new instance; absent values are ignored.
 */
export class Criteria<TField extends string = string> {
  private constructor(
    readonly filters: readonly Filter<TField>[],
    readonly orders: readonly Order<TField>[],
    readonly pagination: Nullable<Pagination>,
  ) {}

  /** Matches everything: no filters, no ordering, no pagination. */
  static none<TField extends string = string>(): Criteria<TField> {
    return new Criteria<TField>([], [], null);
  }

  get hasFilters(): boolean {
    return !!this.filters.length;
  }

  get hasOrders(): boolean {
    return !!this.orders.length;
  }

  get isPaginated(): boolean {
    return !!this.pagination;
  }

  /** Escape hatch for runtime-resolved operators; prefer the named helpers. */
  add(filter: Filter<TField>): Criteria<TField> {
    return new Criteria([...this.filters, filter], this.orders, this.pagination);
  }

  where(field: TField, operator: FilterOperator, value?: FilterValue): Criteria<TField> {
    return this.add(Filter.of(field, operator, value));
  }

  equals(field: TField, value?: Nullable<FilterScalar>): Criteria<TField> {
    return this.compare(field, FilterOperator.EQUAL, value);
  }

  notEquals(field: TField, value?: Nullable<FilterScalar>): Criteria<TField> {
    return this.compare(field, FilterOperator.NOT_EQUAL, value);
  }

  greaterThan(field: TField, value?: Nullable<FilterScalar>): Criteria<TField> {
    return this.compare(field, FilterOperator.GREATER_THAN, value);
  }

  greaterOrEqual(field: TField, value?: Nullable<FilterScalar>): Criteria<TField> {
    return this.compare(field, FilterOperator.GREATER_OR_EQUAL, value);
  }

  lessThan(field: TField, value?: Nullable<FilterScalar>): Criteria<TField> {
    return this.compare(field, FilterOperator.LESS_THAN, value);
  }

  lessOrEqual(field: TField, value?: Nullable<FilterScalar>): Criteria<TField> {
    return this.compare(field, FilterOperator.LESS_OR_EQUAL, value);
  }

  /** Case-insensitive substring match. Blank needles are ignored. */
  contains(field: TField, value?: Nullable<string>): Criteria<TField> {
    if (!value?.trim()) return this;
    return this.where(field, FilterOperator.CONTAINS, value.trim());
  }

  /** Case-insensitive equality. Blank values are ignored. */
  equalsIgnoreCase(field: TField, value?: Nullable<string>): Criteria<TField> {
    if (!value?.trim()) return this;
    return this.where(field, FilterOperator.EQUALS_IGNORE_CASE, value.trim());
  }

  /** Membership. An absent or empty list means "do not filter by this". */
  oneOf(field: TField, values?: Nullable<readonly FilterScalar[]>): Criteria<TField> {
    if (!values?.length) return this;
    return this.where(field, FilterOperator.IN, values);
  }

  /** Inclusive range; a missing bound degrades to the matching comparison. */
  between(field: TField, from?: Nullable<FilterScalar>, to?: Nullable<FilterScalar>): Criteria<TField> {
    if (from === undefined || from === null) return this.lessOrEqual(field, to);
    if (to === undefined || to === null) return this.greaterOrEqual(field, from);
    return this.where(field, FilterOperator.BETWEEN, [from, to]);
  }

  isNull(field: TField): Criteria<TField> {
    return this.where(field, FilterOperator.IS_NULL);
  }

  isNotNull(field: TField): Criteria<TField> {
    return this.where(field, FilterOperator.IS_NOT_NULL);
  }

  /** Appends a sort clause; earlier clauses keep precedence. */
  orderBy(field: TField, type: OrderType = OrderType.ASC): Criteria<TField> {
    return new Criteria(this.filters, [...this.orders, new Order(field, type)], this.pagination);
  }

  /**
   * Fallback ordering: the clauses apply only when no order was stated, so an
   * explicit caller sort always wins. Clauses keep the given precedence.
   */
  orderByDefault(...clauses: readonly OrderClause<TField>[]): Criteria<TField> {
    if (this.hasOrders) return this;

    return clauses.reduce<Criteria<TField>>(
      (criteria, clause) => criteria.orderBy(clause.field, clause.type),
      this,
    );
  }

  /** Applies the shared page-size normalization (default and hard cap). */
  paginate(input: PaginationInput): Criteria<TField> {
    return new Criteria(this.filters, this.orders, normalizePagination(input));
  }

  /** Caps the result set without paging; for internal bounded-batch readers. */
  limitTo(take: number): Criteria<TField> {
    return new Criteria(this.filters, this.orders, { take, skip: 0 });
  }

  private compare(field: TField, operator: FilterOperator, value?: Nullable<FilterScalar>): Criteria<TField> {
    if (value === undefined || value === null) return this;
    return this.where(field, operator, value);
  }
}
