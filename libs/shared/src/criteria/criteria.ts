import {
  Pagination,
  PaginationInput,
  normalizePagination,
} from '../functions/pagination';
import { Nullable } from '../types/nullable.type';
import { Filter, FilterScalar, FilterValue } from './filter';
import { FilterOperator } from './filter-operator';
import { Order } from './order';
import { OrderType } from './order-type';

/**
 * A query expressed as data: what to match, how to sort it and how much of it
 * to return. It knows nothing about SQL or TypeORM, so a use case describes
 * what it wants while every persistence adapter stays free to decide how.
 *
 * `TField` is the union of field names a given aggregate accepts. Typing it
 * turns a misspelled field into a compile error and lets the adapters declare
 * an exhaustive field-to-column map.
 *
 * Every builder method returns a new instance — a criteria handed to a
 * collaborator can never be mutated behind the caller's back.
 *
 * The scalar helpers ignore `undefined` and `null` values on purpose: an
 * absent value means "the caller has no opinion on this field", which is
 * exactly the shape optional query parameters arrive in. Matching a column
 * against NULL is a different intent and has its own method, `isNull`.
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

  /**
   * Adds an already-built filter. The escape hatch used by the HTTP parser,
   * which resolves its operator at runtime; prefer the named helpers in code.
   */
  add(filter: Filter<TField>): Criteria<TField> {
    return new Criteria(
      [...this.filters, filter],
      this.orders,
      this.pagination,
    );
  }

  /** Adds a filter from its parts, skipping the valueless-operator checks. */
  where(
    field: TField,
    operator: FilterOperator,
    value?: FilterValue,
  ): Criteria<TField> {
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

  greaterOrEqual(
    field: TField,
    value?: Nullable<FilterScalar>,
  ): Criteria<TField> {
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
  oneOf(
    field: TField,
    values?: Nullable<readonly FilterScalar[]>,
  ): Criteria<TField> {
    if (!values?.length) return this;
    return this.where(field, FilterOperator.IN, values);
  }

  /**
   * Inclusive range. A half-open range is a legitimate request ("everything
   * from March on"), so a single bound degrades to the matching comparison
   * instead of being rejected.
   */
  between(
    field: TField,
    from?: Nullable<FilterScalar>,
    to?: Nullable<FilterScalar>,
  ): Criteria<TField> {
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
    return new Criteria(
      this.filters,
      [...this.orders, new Order(field, type)],
      this.pagination,
    );
  }

  /** Applies the shared page-size normalization (default and hard cap). */
  paginate(input: PaginationInput): Criteria<TField> {
    return new Criteria(
      this.filters,
      this.orders,
      normalizePagination(input),
    );
  }

  /**
   * Caps the result set without an offset. For internal readers (schedulers,
   * relays) that want a bounded batch rather than a user-facing page.
   */
  limitTo(take: number): Criteria<TField> {
    return new Criteria(this.filters, this.orders, { take, skip: 0 });
  }

  private compare(
    field: TField,
    operator: FilterOperator,
    value?: Nullable<FilterScalar>,
  ): Criteria<TField> {
    if (value === undefined || value === null) return this;
    return this.where(field, operator, value);
  }
}
