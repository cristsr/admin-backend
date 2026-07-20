import { Nullable } from '../types/nullable.type';
import { Criteria } from './criteria';
import { CriteriaFieldDefinition } from './criteria-field-definition.type';
import { CriteriaQueryDto } from './criteria-query.dto';
import {
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
 * Builds a criteria from a list-endpoint query string, validating fields and
 * operators against the schema. `base` carries server-imposed conditions
 * (ownership) that no caller-supplied filter can drop.
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

  return applyOrder(filtered, query, schema).paginate({
    limit: query?.limit,
    offset: query?.offset,
  });
}

function applyOrder<TField extends string>(
  criteria: Criteria<TField>,
  query: Nullable<CriteriaQueryDto>,
  schema: CriteriaSchema<TField>,
): Criteria<TField> {
  if (!query?.orderBy) return criteria;

  return criteria.orderBy(
    sortableField(query.orderBy as TField, schema),
    query.order ?? OrderType.ASC,
  );
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

  if (!raw) {
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

function toSingle(raw: string | string[], field: string): string {
  if (!Array.isArray(raw)) return raw;

  throw new InvalidCriteriaException(
    `Filter on "${field}" expects a single value`,
    { context: { field } },
  );
}

/** Accepts both `value=A,B` and repeated `value[]=A&value[]=B`. */
function toList(raw: string | string[]): string[] {
  if (!Array.isArray(raw)) return toList(raw.split(','));

  return raw.map((member) => member.trim()).filter(Boolean);
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
