import { Nullable } from '../types/nullable.type';
import { Criteria } from './criteria';
import { CriteriaQueryDto } from './criteria-query.dto';
import {
  CriteriaFieldDefinition,
  CriteriaSchema,
  CriteriaValueType,
  allowedOperators,
} from './criteria-schema';
import { Filter, FilterScalar } from './filter';
import {
  FilterOperator,
  LIST_OPERATORS,
  VALUELESS_OPERATORS,
} from './filter-operator';
import { InvalidCriteriaException } from './invalid-criteria.exception';
import { OrderType } from './order-type';

const TRUTHY = ['true', '1'];
const FALSY = ['false', '0'];

/**
 * Turns the query string of a list endpoint into a criteria, validating every
 * field and operator against `schema` on the way.
 *
 * `base` carries the conditions the server imposes and the caller cannot
 * negotiate — ownership being the important one. It is applied first, and
 * since a criteria is append-only, nothing parsed from the query can drop it.
 *
 * @throws InvalidCriteriaException when the caller names an unknown field, an
 * operator the field does not accept, or a value that will not coerce.
 */
export function criteriaFromQuery<TField extends string>(
  query: Nullable<CriteriaQueryDto>,
  schema: CriteriaSchema<TField>,
  base: Criteria<TField> = Criteria.none<TField>(),
): Criteria<TField> {
  const filtered = (query?.filters ?? []).reduce(
    (criteria, raw) =>
      criteria.add(
        buildFilter(raw.field as TField, raw.operator, raw.value, schema),
      ),
    base,
  );

  const ordered = query?.orderBy
    ? filtered.orderBy(
        sortableField(query.orderBy as TField, schema),
        query.order ?? OrderType.ASC,
      )
    : filtered;

  return ordered.paginate({ limit: query?.limit, offset: query?.offset });
}

function buildFilter<TField extends string>(
  field: TField,
  operator: FilterOperator,
  raw: Nullable<string | string[]>,
  schema: CriteriaSchema<TField>,
): Filter<TField> {
  const definition = definitionOf(field, schema);

  if (!allowedOperators(definition).includes(operator)) {
    throw new InvalidCriteriaException(
      `Operator "${operator}" is not allowed on field "${field}"`,
      { context: { field, operator } },
    );
  }

  if (VALUELESS_OPERATORS.includes(operator)) {
    return Filter.of(field, operator);
  }

  if (raw === undefined || raw === null || raw === '') {
    throw new InvalidCriteriaException(
      `Filter on "${field}" requires a value`,
      { context: { field, operator } },
    );
  }

  if (!LIST_OPERATORS.includes(operator)) {
    return Filter.of(field, operator, coerce(toSingle(raw, field), definition, field));
  }

  const members = toList(raw).map((member) => coerce(member, definition, field));

  return Filter.of(field, operator, members);
}

function definitionOf<TField extends string>(
  field: TField,
  schema: CriteriaSchema<TField>,
): CriteriaFieldDefinition {
  const definition = schema[field];

  if (!definition) {
    throw new InvalidCriteriaException(`Unknown filter field "${field}"`, {
      context: { field, allowed: Object.keys(schema) },
    });
  }

  return definition;
}

function sortableField<TField extends string>(
  field: TField,
  schema: CriteriaSchema<TField>,
): TField {
  if (!definitionOf(field, schema).isSortable) {
    throw new InvalidCriteriaException(`Field "${field}" is not sortable`, {
      context: { field },
    });
  }

  return field;
}

/** A repeated query parameter on a scalar operator is a caller mistake. */
function toSingle(raw: string | string[], field: string): string {
  if (!Array.isArray(raw)) return raw;

  throw new InvalidCriteriaException(
    `Filter on "${field}" expects a single value`,
    { context: { field } },
  );
}

/** Accepts both `value=A,B` and repeated `value[]=A&value[]=B`. */
function toList(raw: string | string[]): string[] {
  const members = Array.isArray(raw) ? raw : raw.split(',');
  return members.map((member) => member.trim()).filter(Boolean);
}

function coerce(
  raw: string,
  definition: CriteriaFieldDefinition,
  field: string,
): FilterScalar {
  if (definition.type === CriteriaValueType.STRING) return raw;

  if (definition.type === CriteriaValueType.NUMBER) {
    const parsed = Number(raw);
    if (!raw.trim() || Number.isNaN(parsed)) {
      throw new InvalidCriteriaException(
        `Field "${field}" expects a number, received "${raw}"`,
        { context: { field, value: raw } },
      );
    }
    return parsed;
  }

  if (definition.type === CriteriaValueType.BOOLEAN) {
    const normalized = raw.trim().toLowerCase();
    if (TRUTHY.includes(normalized)) return true;
    if (FALSY.includes(normalized)) return false;
    throw new InvalidCriteriaException(
      `Field "${field}" expects a boolean, received "${raw}"`,
      { context: { field, value: raw } },
    );
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new InvalidCriteriaException(
      `Field "${field}" expects a date, received "${raw}"`,
      { context: { field, value: raw } },
    );
  }

  return date;
}
